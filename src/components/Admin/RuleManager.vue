<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
// @ts-ignore - Vue SFC module resolution
import supabase from '../../lib/Supabase'
// @ts-ignore - Vue SFC module resolution
import RulesCard from './RulesCard.vue'

type RequirementExtra = Record<string, any> | string | null

type Requirement = {
  id: string
  name: string
  type: 'document' | 'condition'
  field_key?: string | null
  operator?: string | null
  value?: string | null
  description?: string | null
  extra?: RequirementExtra
  created_at?: string
}

type RuleRequirementRow = {
  requirement?: Requirement | null
}

type Rule = {
  id: string
  rule_name: string
  description?: string | null
  subsidy_amount: number
  classification?: string | null
  created_at?: string
  requirements: Requirement[]
}

const props = defineProps<{ providerId: string | null; requirements: Requirement[] }>()

const emit = defineEmits<{
  (event: 'notify', payload: { text: string; color?: string }): void
  (event: 'rules-loaded', payload: Rule[]): void
}>()

const rules = ref<Rule[]>([])
const rulesLoading = ref(false)
const errorMsg = ref('')

const editorOpen = ref(false)
const editorLoading = ref(false)
const isEdit = ref(false)
const currentId = ref<string | null>(null)
const formName = ref('')
const formDescription = ref('')
const formAmount = ref<number | null>(null)
const formClassification = ref('Partial')
const selectedRequirementIds = ref<string[]>([])

const confirmDeleteOpen = ref(false)
const toDeleteId = ref<string | null>(null)

const rulesChannel = ref<any | null>(null)

const hasRules = computed(() => !rulesLoading.value && rules.value.length > 0)
const requirementItems = computed(() => props.requirements)

const operatorLabels: Record<string, string> = {
  equals: 'Equals',
  not_equals: 'Not Equals',
  greater_than: 'Greater Than',
  greater_or_equal: 'Greater or Equal',
  less_than: 'Less Than',
  less_or_equal: 'Less or Equal',
  contains: 'Contains',
}

function formatOperator(operator?: string | null) {
  if (!operator) return ''
  return operatorLabels[operator] || operator.replace(/_/g, ' ')
}

function extractRequirementNote(extra?: RequirementExtra | undefined): string | null {
  if (!extra) return null
  if (typeof extra === 'string') return extra
  if (typeof extra === 'object') {
    const candidate = extra.note || extra.instructions || extra.details || extra.detail
    if (candidate) return String(candidate)
  }
  try {
    return JSON.stringify(extra)
  } catch (e) {
    return null
  }
}

function requirementSummary(req: Requirement) {
  if (req.type === 'document') {
    return req.description?.trim() || extractRequirementNote(req.extra) || `Provide ${req.name}`
  }

  const field = req.field_key?.trim() || 'value'
  const operator = formatOperator(req.operator)?.toLowerCase()
  const value = (req.value ?? '').toString().trim()

  return [field, operator, value].filter(Boolean).join(' ').trim()
}

function requirementSelectLabel(req: Requirement) {
  const prefix = req.type === 'document' ? 'Document' : 'Condition'
  return `${prefix} • ${req.name}`
}

function notify(text: string, color: string = 'success') {
  emit('notify', { text, color })
}

function resetRuleForm() {
  formName.value = ''
  formDescription.value = ''
  formAmount.value = null
  formClassification.value = 'Partial'
  selectedRequirementIds.value = []
}

function openCreateRule() {
  isEdit.value = false
  currentId.value = null
  resetRuleForm()
  editorOpen.value = true
}

function openEditRule(rule: Rule) {
  isEdit.value = true
  currentId.value = rule.id
  formName.value = rule.rule_name
  formDescription.value = rule.description || ''
  formAmount.value = rule.subsidy_amount ?? null
  formClassification.value = rule.classification || 'Partial'
  selectedRequirementIds.value = rule.requirements.map((r) => r.id)
  editorOpen.value = true
}

async function fetchRules() {
  if (!props.providerId) {
    rules.value = []
    emit('rules-loaded', [])
    return
  }
  rulesLoading.value = true
  errorMsg.value = ''
  try {
    const { data, error } = await supabase
      .from('subsidy_rules')
      .select(
        `id, rule_name, description, subsidy_amount, classification, provider_id, created_at,
         rule_requirements:subsidy_rule_requirements (
           requirement:subsidy_requirements (
             id, name, type, field_key, operator, value, description, extra, created_at
           )
         )`,
      )
      .eq('provider_id', props.providerId)
      .order('created_at', { ascending: false })
    if (error) throw error

    rules.value = (data || []).map((row: any) => {
      const requirementRows = ((row.rule_requirements as RuleRequirementRow[] | null) || [])
        .map((link) => {
          const req = link?.requirement
          if (!req) return null
          return {
            id: String(req.id),
            name: req.name,
            type: (req.type as 'document' | 'condition') ?? 'document',
            field_key: req.field_key,
            operator: req.operator,
            value: req.value,
            description: req.description,
            extra: req.extra,
            created_at: req.created_at,
          } as Requirement
        })
        .filter(Boolean) as Requirement[]

      return {
        id: String(row.id),
        rule_name: row.rule_name,
        description: row.description,
        subsidy_amount: Number(row.subsidy_amount),
        classification: row.classification,
        created_at: row.created_at,
        requirements: requirementRows,
      }
    }) as Rule[]

    emit('rules-loaded', rules.value)
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to load rules.'
    rules.value = []
    emit('rules-loaded', [])
  } finally {
    rulesLoading.value = false
  }
}

async function saveRule() {
  if (!props.providerId) return
  editorLoading.value = true
  try {
    if (!formName.value.trim()) throw new Error('Rule name is required')
    if (formAmount.value == null || Number.isNaN(formAmount.value))
      throw new Error('Subsidy amount is required')

    const payload = {
      provider_id: props.providerId,
      rule_name: formName.value.trim(),
      description: formDescription.value.trim() || null,
      subsidy_amount: formAmount.value,
      classification: formClassification.value,
    }

    let ruleId: string

    if (isEdit.value && currentId.value) {
      const { error } = await supabase
        .from('subsidy_rules')
        .update(payload)
        .eq('id', currentId.value)
        .eq('provider_id', props.providerId)
      if (error) throw error
      ruleId = String(currentId.value)
      await supabase.from('subsidy_rule_requirements').delete().eq('rule_id', ruleId)
      notify('Rule updated')
    } else {
      const { data, error } = await supabase
        .from('subsidy_rules')
        .insert([payload])
        .select('id')
        .single()
      if (error) throw error
      ruleId = String(data.id)
      notify('Rule created')
    }

    if (selectedRequirementIds.value.length) {
      const inserts = selectedRequirementIds.value.map((reqId) => {
        const numericId = Number(reqId)
        return {
          rule_id: Number(ruleId) || ruleId,
          requirement_id: Number.isNaN(numericId) ? reqId : numericId,
        }
      })
      const { error: linkError } = await supabase.from('subsidy_rule_requirements').insert(inserts)
      if (linkError) throw linkError
    }

    editorOpen.value = false
    await fetchRules()
  } catch (e: any) {
    notify(e?.message || 'Saving rule failed', 'error')
  } finally {
    editorLoading.value = false
  }
}

function confirmRuleDelete(id: string) {
  toDeleteId.value = id
  confirmDeleteOpen.value = true
}

async function deleteRule() {
  if (!toDeleteId.value || !props.providerId) return
  try {
    const { error } = await supabase
      .from('subsidy_rules')
      .delete()
      .eq('id', toDeleteId.value)
      .eq('provider_id', props.providerId)
    if (error) throw error
    notify('Rule deleted')
    confirmDeleteOpen.value = false
    toDeleteId.value = null
    await fetchRules()
  } catch (e: any) {
    notify(e?.message || 'Delete failed', 'error')
  }
}

function copyRule(rule: Rule) {
  try {
    const payload = {
      ...rule,
      requirements: rule.requirements,
    }
    const json = JSON.stringify(payload, null, 2)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(json)
    }
    notify('Rule copied to clipboard')
  } catch (e) {
    console.error('Failed to copy rule', e)
  }
}

function toRuleCard(rule: Rule) {
  const conditions = rule.requirements.reduce(
    (acc, requirement, index) => {
      const prefix = requirement.type === 'document' ? 'Document' : 'Condition'
      const labelBase = requirement.name?.trim() || `Requirement ${index + 1}`
      const label = `${prefix}: ${labelBase}`
      acc[label] = requirementSummary(requirement)
      return acc
    },
    {} as Record<string, string>,
  )

  return {
    id: rule.id,
    rule_name: rule.rule_name,
    description: rule.description,
    classification: rule.classification,
    subsidy_amount: rule.subsidy_amount,
    requirements: rule.requirements,
    conditions,
    created_at: rule.created_at,
  }
}

function refresh() {
  fetchRules()
}

defineExpose({ refresh })

function subscribeRealtime() {
  if (rulesChannel.value) {
    supabase.removeChannel(rulesChannel.value)
    rulesChannel.value = null
  }
  if (!props.providerId) return

  rulesChannel.value = supabase
    .channel(`rules-${props.providerId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'subsidy_rules',
        filter: `provider_id=eq.${props.providerId}`,
      },
      () => fetchRules(),
    )
    .subscribe()
}

watch(
  () => props.providerId,
  async () => {
    if (!props.providerId) {
      rules.value = []
      emit('rules-loaded', [])
      if (rulesChannel.value) {
        supabase.removeChannel(rulesChannel.value)
        rulesChannel.value = null
      }
      return
    }
    await fetchRules()
    subscribeRealtime()
  },
  { immediate: true },
)

watch(
  () => props.requirements.map((req) => req.id),
  (latestIds) => {
    const validIds = new Set(latestIds)
    selectedRequirementIds.value = selectedRequirementIds.value.filter((id) => validIds.has(id))
  },
)

onBeforeUnmount(() => {
  if (rulesChannel.value) supabase.removeChannel(rulesChannel.value)
})
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h3 class="text-h6 text-md-h5 me-3">Rules</h3>
      <v-chip v-if="rules.length" size="small" color="primary" variant="flat">
        {{ rules.length }} total
      </v-chip>
      <v-spacer />
      <v-btn
        size="small"
        color="primary"
        prepend-icon="mdi-plus"
        class="me-2"
        @click="openCreateRule"
        :disabled="!props.providerId"
      >
        New Rule
      </v-btn>
    </div>

    <v-alert v-if="errorMsg" type="error" class="mb-4">{{ errorMsg }}</v-alert>

    <v-row v-if="rulesLoading" class="mb-4">
      <v-col cols="12" md="6" lg="4" v-for="i in 6" :key="`rule-skeleton-${i}`">
        <v-skeleton-loader type="card, actions" />
      </v-col>
    </v-row>

    <v-row v-else-if="hasRules">
      <v-col cols="12" md="6" lg="4" v-for="r in rules" :key="r.id" class="d-flex">
        <RulesCard
          class="flex-grow-1"
          :rule="toRuleCard(r)"
          amount-label="Amount"
          :requirements-label="'requirements'"
          empty-requirements-text="No requirements linked."
          @edit="() => openEditRule(r)"
          @delete="confirmRuleDelete"
          @copy="() => copyRule(r)"
        />
      </v-col>
    </v-row>

    <v-empty-state
      v-else
      icon="mdi-clipboard-list-outline"
      title="No rules yet"
      text="Create your first rule to see it here."
    />

    <!-- Rule Editor Dialog -->
    <v-dialog v-model="editorOpen" max-width="680">
      <v-card>
        <v-card-title class="text-h6">{{ isEdit ? 'Edit Rule' : 'New Rule' }}</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="saveRule">
            <v-text-field v-model="formName" label="Rule name" required />
            <v-textarea v-model="formDescription" label="Description" rows="3" />
            <v-text-field
              v-model.number="formAmount"
              label="Subsidy amount"
              type="number"
              min="0"
              required
            />
            <v-select
              v-model="formClassification"
              :items="['Partial', 'Full', 'Special']"
              label="Classification"
            />
            <v-select
              v-model="selectedRequirementIds"
              :items="requirementItems"
              :item-title="requirementSelectLabel"
              item-value="id"
              label="Linked requirements"
              multiple
              chips
              closable-chips
              hint="Select at least one requirement to attach"
              persistent-hint
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editorOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="editorLoading" @click="saveRule">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Rule Delete Dialog -->
    <v-dialog v-model="confirmDeleteOpen" max-width="420">
      <v-card>
        <v-card-title class="text-h6">Delete Rule</v-card-title>
        <v-card-text>Are you sure you want to delete this rule?</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmDeleteOpen = false">Cancel</v-btn>
          <v-btn color="error" @click="deleteRule">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
