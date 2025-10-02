<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
// @ts-ignore - Vue SFC module resolution
import supabase from '../../lib/Supabase'
// @ts-ignore - Pinia alias resolution within SFC context
import { useUserStore } from '../../stores/users'
// @ts-ignore - Vue SFC module resolution
import AdminLayout from '../../layouts/AdminLayout.vue'
// @ts-ignore - Vue SFC module resolution
import RulesCard from '../../components/Admin/RulesCard.vue'

type Requirement = {
  id: string
  name: string
  field_key: string
  operator: string
  value: string
  description?: string | null
  created_at?: string
}

type RuleRequirementRow = {
  requirement?: Requirement | null
}

type MyRule = {
  id: string
  rule_name: string
  description?: string | null
  subsidy_amount: number
  classification?: string | null
  created_at?: string
  requirements: Requirement[]
}

const userStore = useUserStore()
const providerId = ref<string | null>(null)

const snackbar = ref<{ show: boolean; text: string; color: string }>({
  show: false,
  text: '',
  color: 'success',
})

// Requirement state
const requirements = ref<Requirement[]>([])
const requirementsLoading = ref(false)
const requirementsError = ref('')

const reqEditorOpen = ref(false)
const reqEditorLoading = ref(false)
const reqIsEdit = ref(false)
const reqCurrentId = ref<string | null>(null)
const reqFormName = ref('')
const reqFormFieldKey = ref('')
const reqFormOperator = ref('equals')
const reqFormValue = ref('')
const reqFormDescription = ref('')

const confirmReqDeleteOpen = ref(false)
const reqDeleteId = ref<string | null>(null)

const operatorOptions = [
  { title: 'Equals', value: 'equals' },
  { title: 'Not Equals', value: 'not_equals' },
  { title: 'Greater Than', value: 'greater_than' },
  { title: 'Greater or Equal', value: 'greater_or_equal' },
  { title: 'Less Than', value: 'less_than' },
  { title: 'Less or Equal', value: 'less_or_equal' },
  { title: 'Contains', value: 'contains' },
]

const operatorLabels: Record<string, string> = {
  equals: 'Equals',
  not_equals: 'Not Equals',
  greater_than: 'Greater Than',
  greater_or_equal: 'Greater or Equal',
  less_than: 'Less Than',
  less_or_equal: 'Less or Equal',
  contains: 'Contains',
}

function formatOperator(operator: string) {
  return operatorLabels[operator] || operator.replace(/_/g, ' ')
}

function requirementSummary(req: Requirement) {
  return (
    req.description?.trim() ||
    `${req.field_key} ${formatOperator(req.operator).toLowerCase()} ${req.value}`
  )
}

function toRuleCard(rule: MyRule) {
  const conditions = rule.requirements.reduce(
    (acc, requirement, index) => {
      const label = requirement.name || `Requirement ${index + 1}`
      acc[label] = requirementSummary(requirement)
      return acc
    },
    {} as Record<string, string>,
  )

  return {
    id: rule.id,
    rule_name: rule.rule_name,
    subsidy_amount: rule.subsidy_amount,
    conditions,
    created_at: rule.created_at,
    requirements: rule.requirements,
  }
}

// Rule state
const rules = ref<MyRule[]>([])
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
const requirementsChannel = ref<any | null>(null)

const hasRules = computed(() => !rulesLoading.value && rules.value.length > 0)
const hasRequirements = computed(() => !requirementsLoading.value && requirements.value.length > 0)

function notify(text: string, color: string = 'success') {
  snackbar.value = { show: true, text, color }
}

function resetRequirementForm() {
  reqFormName.value = ''
  reqFormFieldKey.value = ''
  reqFormOperator.value = 'equals'
  reqFormValue.value = ''
  reqFormDescription.value = ''
}

function openRequirementCreate() {
  reqIsEdit.value = false
  reqCurrentId.value = null
  resetRequirementForm()
  reqEditorOpen.value = true
}

function openRequirementEdit(req: Requirement) {
  reqIsEdit.value = true
  reqCurrentId.value = req.id
  reqFormName.value = req.name
  reqFormFieldKey.value = req.field_key
  reqFormOperator.value = req.operator
  reqFormValue.value = req.value
  reqFormDescription.value = req.description || ''
  reqEditorOpen.value = true
}

async function saveRequirement() {
  if (!providerId.value) return
  reqEditorLoading.value = true
  try {
    if (!reqFormName.value.trim()) throw new Error('Requirement name is required')
    if (!reqFormFieldKey.value.trim()) throw new Error('Field key is required')
    if (!reqFormValue.value.trim()) throw new Error('Value is required')

    const payload = {
      provider_id: providerId.value,
      name: reqFormName.value.trim(),
      field_key: reqFormFieldKey.value.trim(),
      operator: reqFormOperator.value,
      value: reqFormValue.value.trim(),
      description: reqFormDescription.value.trim() || null,
    }

    if (reqIsEdit.value && reqCurrentId.value) {
      const { error } = await supabase
        .from('subsidy_requirements')
        .update(payload)
        .eq('id', reqCurrentId.value)
        .eq('provider_id', providerId.value)
      if (error) throw error
      notify('Requirement updated')
    } else {
      const { data, error } = await supabase
        .from('subsidy_requirements')
        .insert([payload])
        .select('id')
        .single()
      if (error) throw error
      notify('Requirement created')
    }

    reqEditorOpen.value = false
    await fetchRequirements()
  } catch (e: any) {
    notify(e?.message || 'Saving requirement failed', 'error')
  } finally {
    reqEditorLoading.value = false
  }
}

function confirmRequirementDelete(id: string) {
  reqDeleteId.value = id
  confirmReqDeleteOpen.value = true
}

async function deleteRequirement() {
  if (!reqDeleteId.value || !providerId.value) return
  try {
    const { error } = await supabase
      .from('subsidy_requirements')
      .delete()
      .eq('id', reqDeleteId.value)
      .eq('provider_id', providerId.value)
    if (error) throw error
    notify('Requirement deleted')
    confirmReqDeleteOpen.value = false
    reqDeleteId.value = null
    await fetchRequirements()
    selectedRequirementIds.value = selectedRequirementIds.value.filter((id) =>
      requirements.value.some((req) => req.id === id),
    )
  } catch (e: any) {
    notify(e?.message || 'Delete failed', 'error')
  }
}

async function fetchRequirements() {
  if (!providerId.value) return
  requirementsLoading.value = true
  requirementsError.value = ''
  try {
    const { data, error } = await supabase
      .from('subsidy_requirements')
      .select('id, name, field_key, operator, value, description, created_at')
      .eq('provider_id', providerId.value)
      .order('created_at', { ascending: false })
    if (error) throw error
    requirements.value = (data || []) as Requirement[]
  } catch (e: any) {
    requirementsError.value = e?.message || 'Failed to load requirements.'
    requirements.value = []
  } finally {
    requirementsLoading.value = false
  }
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

function openEditRule(rule: MyRule) {
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
  if (!providerId.value) return
  rulesLoading.value = true
  errorMsg.value = ''
  try {
    const { data, error } = await supabase
      .from('subsidy_rules')
      .select(
        `id, rule_name, description, subsidy_amount, classification, created_at,
         rule_requirements:subsidy_rule_requirements (
           requirement:subsidy_requirements (id, name, field_key, operator, value, description, created_at)
         )`,
      )
      .eq('provider_id', providerId.value)
      .order('created_at', { ascending: false })
    if (error) throw error
    rules.value = (data || []).map((row: any) => ({
      id: row.id,
      rule_name: row.rule_name,
      description: row.description,
      subsidy_amount: Number(row.subsidy_amount),
      classification: row.classification,
      created_at: row.created_at,
      requirements:
        (row.rule_requirements as RuleRequirementRow[] | null)
          ?.map((link) => link.requirement)
          .filter(Boolean) || [],
    })) as MyRule[]
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to load rules.'
    rules.value = []
  } finally {
    rulesLoading.value = false
  }
}

async function saveRule() {
  if (!providerId.value) return
  editorLoading.value = true
  try {
    if (!formName.value.trim()) throw new Error('Rule name is required')
    if (formAmount.value == null || Number.isNaN(formAmount.value))
      throw new Error('Subsidy amount is required')

    const payload = {
      provider_id: providerId.value,
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
        .eq('provider_id', providerId.value)
      if (error) throw error
      ruleId = currentId.value
      await supabase.from('subsidy_rule_requirements').delete().eq('rule_id', ruleId)
      notify('Rule updated')
    } else {
      const { data, error } = await supabase
        .from('subsidy_rules')
        .insert([payload])
        .select('id')
        .single()
      if (error) throw error
      ruleId = data.id
      notify('Rule created')
    }

    if (selectedRequirementIds.value.length) {
      const inserts = selectedRequirementIds.value.map((reqId) => ({
        rule_id: ruleId,
        requirement_id: reqId,
      }))
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
  if (!toDeleteId.value || !providerId.value) return
  try {
    const { error } = await supabase
      .from('subsidy_rules')
      .delete()
      .eq('id', toDeleteId.value)
      .eq('provider_id', providerId.value)
    if (error) throw error
    notify('Rule deleted')
    confirmDeleteOpen.value = false
    toDeleteId.value = null
    await fetchRules()
  } catch (e: any) {
    notify(e?.message || 'Delete failed', 'error')
  }
}

function copyRule(rule: MyRule) {
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

function refresh() {
  fetchRequirements()
  fetchRules()
}

function subscribeRealtime() {
  if (rulesChannel.value) supabase.removeChannel(rulesChannel.value)
  if (requirementsChannel.value) supabase.removeChannel(requirementsChannel.value)
  if (!providerId.value) return

  rulesChannel.value = supabase
    .channel(`rules-${providerId.value}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'subsidy_rules',
        filter: `provider_id=eq.${providerId.value}`,
      },
      () => fetchRules(),
    )
    .subscribe()

  requirementsChannel.value = supabase
    .channel(`requirements-${providerId.value}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'subsidy_requirements',
        filter: `provider_id=eq.${providerId.value}`,
      },
      () => fetchRequirements(),
    )
    .subscribe()
}

watch(
  () => userStore.user_id,
  async (id) => {
    if (!id) return
    providerId.value = id
    await fetchRequirements()
    await fetchRules()
    subscribeRealtime()
  },
  { immediate: true },
)

onMounted(async () => {
  if (!userStore.isUserLoaded) await userStore.fetchUser()
  if (!providerId.value && userStore.user_id) {
    providerId.value = userStore.user_id
    await fetchRequirements()
    await fetchRules()
    subscribeRealtime()
  }
})

onBeforeUnmount(() => {
  if (rulesChannel.value) supabase.removeChannel(rulesChannel.value)
  if (requirementsChannel.value) supabase.removeChannel(requirementsChannel.value)
})
</script>

<template>
  <AdminLayout>
    <v-container fluid class="py-4">
      <div class="d-flex align-center mb-6">
        <div>
          <h2 class="text-h6 text-md-h5 mb-1">My Subsidy Programs</h2>
          <p class="text-caption text-medium-emphasis mb-0">
            Manage reusable requirements and bundle them into rules for your applicants.
          </p>
        </div>
        <v-spacer />
        <v-btn size="small" variant="text" prepend-icon="mdi-refresh" @click="refresh">
          Refresh
        </v-btn>
      </div>

      <!-- Requirements Management -->
      <v-card class="mb-6" elevation="8">
        <v-card-title class="d-flex align-center">
          <span class="text-subtitle-1">Requirements</span>
          <v-chip
            v-if="requirements.length"
            size="x-small"
            color="primary"
            variant="flat"
            class="ms-3"
          >
            {{ requirements.length }} total
          </v-chip>
          <v-spacer />
          <v-btn
            size="small"
            color="primary"
            prepend-icon="mdi-plus"
            @click="openRequirementCreate"
          >
            New Requirement
          </v-btn>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <v-alert v-if="requirementsError" type="error" class="mb-4">
            {{ requirementsError }}
          </v-alert>

          <v-skeleton-loader v-if="requirementsLoading" type="table" />

          <div v-else-if="hasRequirements">
            <v-table density="comfortable">
              <thead>
                <tr>
                  <th class="text-left">Name</th>
                  <th class="text-left">Field</th>
                  <th class="text-left">Operator</th>
                  <th class="text-left">Value</th>
                  <th class="text-left">Description</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="req in requirements" :key="req.id">
                  <td class="font-weight-medium">{{ req.name }}</td>
                  <td>{{ req.field_key }}</td>
                  <td class="text-capitalize">{{ formatOperator(req.operator) }}</td>
                  <td>{{ req.value }}</td>
                  <td class="text-body-2 text-medium-emphasis">{{ req.description || '—' }}</td>
                  <td class="text-right">
                    <v-btn
                      size="x-small"
                      variant="text"
                      prepend-icon="mdi-pencil"
                      @click="openRequirementEdit(req)"
                    >
                      Edit
                    </v-btn>
                    <v-btn
                      size="x-small"
                      variant="text"
                      color="error"
                      prepend-icon="mdi-delete"
                      @click="confirmRequirementDelete(req.id)"
                    >
                      Delete
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>

          <v-empty-state
            v-else
            icon="mdi-format-list-bulleted"
            title="No requirements yet"
            text="Create requirements to reuse across multiple rules."
          />
        </v-card-text>
      </v-card>

      <!-- Rules Section -->
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
            :conditions-label="'requirements'"
            empty-conditions-text="No requirements linked."
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
    </v-container>

    <!-- Requirement Dialog -->
    <v-dialog v-model="reqEditorOpen" max-width="540">
      <v-card>
        <v-card-title class="text-h6">{{
          reqIsEdit ? 'Edit Requirement' : 'New Requirement'
        }}</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="saveRequirement">
            <v-text-field v-model="reqFormName" label="Requirement name" required />
            <v-text-field
              v-model="reqFormFieldKey"
              label="Field key (e.g. household_income)"
              required
            />
            <v-select
              v-model="reqFormOperator"
              :items="operatorOptions"
              label="Operator"
              item-title="title"
              item-value="value"
            />
            <v-text-field v-model="reqFormValue" label="Value" required />
            <v-textarea v-model="reqFormDescription" label="Description" rows="2" />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="reqEditorOpen = false">Cancel</v-btn>
          <v-btn color="primary" :loading="reqEditorLoading" @click="saveRequirement">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Requirement Delete Dialog -->
    <v-dialog v-model="confirmReqDeleteOpen" max-width="420">
      <v-card>
        <v-card-title class="text-h6">Delete Requirement</v-card-title>
        <v-card-text
          >Deleting this requirement removes it from all linked rules. Continue?</v-card-text
        >
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmReqDeleteOpen = false">Cancel</v-btn>
          <v-btn color="error" @click="deleteRequirement">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
              :items="requirements"
              item-title="name"
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

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2500">
      {{ snackbar.text }}
    </v-snackbar>
  </AdminLayout>
</template>
