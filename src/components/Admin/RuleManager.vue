<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import supabase from '../../lib/Supabase'
// Rules list card is rendered inline below to avoid import issues

type RequirementExtra = Record<string, unknown> | string | null

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

// (Removed intermediate RuleRequirementRow type, mapping now uses generic records)

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

const rulesChannel = ref<unknown | null>(null)

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
  } catch {
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

    type Row = Record<string, unknown>
    rules.value = (data || []).map((row: Row) => {
      const links =
        (row.rule_requirements as Array<{ requirement?: Record<string, unknown> | null }> | null) ||
        []
      const requirementRows = links
        .map((link) => {
          const req = link?.requirement
          if (!req) return null
          return {
            id: String(req.id as string | number),
            name: String(req.name ?? ''),
            type: (req.type === 'condition' ? 'condition' : 'document') as 'document' | 'condition',
            field_key: (req.field_key as string | null | undefined) ?? null,
            operator: (req.operator as string | null | undefined) ?? null,
            value: (req.value as string | null | undefined) ?? null,
            description: (req.description as string | null | undefined) ?? null,
            extra: req.extra as RequirementExtra,
            created_at: req.created_at as string | undefined,
          } as Requirement
        })
        .filter(Boolean) as Requirement[]

      return {
        id: String(row.id as string | number),
        rule_name: String(row.rule_name ?? ''),
        description: (row.description as string | null | undefined) ?? null,
        subsidy_amount: Number(row.subsidy_amount ?? 0),
        classification: (row.classification as string | null | undefined) ?? null,
        created_at: row.created_at as string | undefined,
        requirements: requirementRows,
      }
    }) as Rule[]

    emit('rules-loaded', rules.value)
  } catch (err: unknown) {
    errorMsg.value =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message?: string }).message || 'Failed to load rules.'
        : 'Failed to load rules.'
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
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message?: string }).message
        : 'Saving rule failed'
    notify(msg || 'Saving rule failed', 'error')
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
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err
        ? (err as { message?: string }).message
        : 'Delete failed'
    notify(msg || 'Delete failed', 'error')
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
  } catch (err: unknown) {
    console.error('Failed to copy rule', err)
  }
}

// Removed toRuleCard helper since we render inline now

function refresh() {
  fetchRules()
}

defineExpose({ refresh })

function subscribeRealtime() {
  if (rulesChannel.value) {
    // @ts-expect-error: removeChannel type mismatch in our runtime version
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
        // @ts-expect-error: removeChannel type mismatch in our runtime version
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
  if (rulesChannel.value) {
    // @ts-expect-error: removeChannel type mismatch in our runtime version
    supabase.removeChannel(rulesChannel.value)
  }
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
        <v-card class="grow d-flex flex-column">
          <v-card-item>
            <v-card-title class="text-subtitle-1">{{ r.rule_name }}</v-card-title>
            <v-card-subtitle class="d-flex align-center flex-wrap ga-2">
              <v-chip size="x-small" color="primary" variant="flat">
                Amount: {{ r.subsidy_amount }}
              </v-chip>
              <v-chip v-if="r.classification" size="x-small" color="secondary" variant="tonal">
                {{ r.classification }}
              </v-chip>
              <v-chip size="x-small" color="info" variant="tonal">
                {{ r.requirements.length }} requirements
              </v-chip>
              <span class="text-caption text-medium-emphasis ms-auto" v-if="r.created_at">
                {{ new Date(r.created_at).toLocaleString() }}
              </span>
            </v-card-subtitle>
          </v-card-item>
          <v-divider />
          <v-card-text class="d-flex flex-column ga-3">
            <div v-if="r.description" class="text-body-2">{{ r.description }}</div>
            <div v-if="r.requirements.length" class="d-flex flex-column ga-3">
              <div
                v-for="(req, idx) in r.requirements"
                :key="req.id || idx"
                class="rounded pa-3"
                style="
                  background: rgba(var(--v-theme-surface-variant), 0.45);
                  border: 1px solid rgba(var(--v-border-color), 0.08);
                "
              >
                <div class="text-body-2 font-weight-medium">
                  {{ req.name }} <span class="text-caption">({{ req.type }})</span>
                </div>
                <div class="text-caption text-medium-emphasis">{{ requirementSummary(req) }}</div>
              </div>
            </div>
            <div v-else class="text-caption text-medium-emphasis">No requirements linked.</div>
          </v-card-text>
          <v-divider />
          <v-card-actions>
            <v-btn
              size="small"
              variant="text"
              color="primary"
              prepend-icon="mdi-pencil"
              @click="() => openEditRule(r)"
              >Edit</v-btn
            >
            <v-btn
              size="small"
              variant="text"
              color="error"
              prepend-icon="mdi-delete"
              @click="() => confirmRuleDelete(r.id)"
              >Delete</v-btn
            >
            <v-spacer />
            <v-tooltip text="Copy JSON" location="top">
              <template #activator="{ props: p }">
                <v-btn v-bind="p" icon size="small" @click="() => copyRule(r)">
                  <v-icon size="18">mdi-content-copy</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
          </v-card-actions>
        </v-card>
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
