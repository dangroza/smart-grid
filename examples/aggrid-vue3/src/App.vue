<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { AgGridVue } from 'ag-grid-vue3';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import type { ColDef, GridReadyEvent } from 'ag-grid-community';
import { createBenchmarkTracker, type BenchmarkSummary } from '../../shared/benchmark';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([AllCommunityModule]);
const modules = [AllCommunityModule];

const ROW_COUNT = 50_000;
const COL_COUNT = 50;

const status = ref('Preparing dataset…');
const benchmarkResults = ref<BenchmarkSummary[]>([]);
const quickFilter = ref('');
const gridApi = ref<GridReadyEvent['api'] | null>(null);
const rowData = ref<Record<string, unknown>[]>([]);
const columnDefs = ref<ColDef[]>([]);
const benchmark = createBenchmarkTracker();

const initStart = performance.now();

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function generateColumns(count: number): ColDef[] {
  const base: ColDef[] = [
    { field: 'id', headerName: 'ID', width: 84, sortable: true, pinned: 'left' },
    { field: 'firstName', headerName: 'First Name', width: 140, sortable: true, filter: true },
    { field: 'lastName', headerName: 'Last Name', width: 140, sortable: true, filter: true },
    { field: 'email', headerName: 'Email', width: 220, sortable: true, filter: true },
    { field: 'department', headerName: 'Department', width: 140, sortable: true, filter: true },
    { field: 'status', headerName: 'Status', width: 120, sortable: true, filter: true },
    { field: 'salary', headerName: 'Salary', width: 120, sortable: true },
    { field: 'rating', headerName: 'Rating', width: 100, sortable: true },
    { field: 'projects', headerName: 'Projects', width: 110, sortable: true },
  ];

  for (let i = base.length; i < count; i++) {
    base.push({
      field: `col_${i}`,
      headerName: `Column ${i + 1}`,
      width: 120,
      sortable: true,
    });
  }

  return base;
}

function generateRows(count: number, columnCount: number): Record<string, unknown>[] {
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace'];
  const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Taylor', 'Moore'];
  const departments = ['Engineering', 'Sales', 'Product', 'Support', 'Marketing'];
  const statuses = ['Active', 'Inactive', 'Pending'];

  return Array.from({ length: count }, (_, index) => {
    const firstName = randomFrom(firstNames);
    const lastName = randomFrom(lastNames);

    const row: Record<string, unknown> = {
      id: index + 1,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`,
      department: randomFrom(departments),
      status: randomFrom(statuses),
      salary: Math.floor(40_000 + Math.random() * 110_000),
      rating: Math.round((1 + Math.random() * 4) * 10) / 10,
      projects: Math.floor(Math.random() * 20),
    };

    for (let c = 9; c < columnCount; c++) {
      row[`col_${c}`] = `R${index + 1}C${c + 1}`;
    }

    return row;
  });
}

function syncResults(): void {
  benchmarkResults.value = benchmark.getSummaries();
}

function onGridReady(event: GridReadyEvent): void {
  gridApi.value = event.api;
  const end = performance.now();
  status.value = `AG Grid Vue 3 ready — ${(end - initStart).toFixed(1)}ms init`;
}

function runSortBenchmark(): void {
  if (!gridApi.value) return;
  void benchmark.measure('sort:salary-desc', () => {
    gridApi.value?.applyColumnState({
      state: [{ colId: 'salary', sort: 'desc' }],
      defaultState: { sort: null },
    });
  }).then(syncResults);
}

function applyQuickFilter(): void {
  if (!gridApi.value) return;
  const query = quickFilter.value;
  void benchmark.measure(`filter:quick:${query}`, () => {
    gridApi.value?.setGridOption('quickFilterText', query);
  }).then(syncResults);
}

function clearFilters(): void {
  if (!gridApi.value) return;
  void benchmark.measure('filter:clear', () => {
    gridApi.value?.setGridOption('quickFilterText', '');
    gridApi.value?.setFilterModel(null);
  }).then(syncResults);
}

async function runAllBenchmarks(): Promise<void> {
  runSortBenchmark();
  await benchmark.measure('filter:quick:alice', () => {
    quickFilter.value = 'alice';
    gridApi.value?.setGridOption('quickFilterText', 'alice');
  });
  await benchmark.measure('filter:clear', () => {
    gridApi.value?.setGridOption('quickFilterText', '');
    gridApi.value?.setFilterModel(null);
  });
  syncResults();
}

onMounted(() => {
  const dataStart = performance.now();
  columnDefs.value = generateColumns(COL_COUNT);
  rowData.value = generateRows(ROW_COUNT, COL_COUNT);
  const dataEnd = performance.now();
  benchmark.addSample('dataset:generate', dataEnd - dataStart);
  syncResults();
  status.value = `Dataset ready (${ROW_COUNT.toLocaleString()}×${COL_COUNT}) in ${(dataEnd - dataStart).toFixed(1)}ms`;
});
</script>

<template>
  <main class="page">
    <header class="toolbar">
      <h1>AG Grid Community (Vue 3) Benchmark</h1>
      <div class="status">{{ status }}</div>
    </header>

    <section class="controls">
      <button type="button" @click="runSortBenchmark">Benchmark sort</button>
      <input v-model="quickFilter" placeholder="quick filter text" />
      <button type="button" @click="applyQuickFilter">Apply filter</button>
      <button type="button" @click="clearFilters">Clear filters</button>
      <button type="button" @click="runAllBenchmarks">Run all</button>
      <span class="note">Compare against examples/basic using same interactions.</span>
    </section>

    <section class="layout">
      <div class="ag-theme-quartz grid-host">
        <AgGridVue
          class="ag-grid-component"
          :modules="modules"
          :column-defs="columnDefs"
          :row-data="rowData"
          :default-col-def="{ resizable: true, sortable: true }"
          :animate-rows="false"
          :row-height="40"
          :header-height="44"
          :pagination="true"
          :pagination-page-size="500"
          :suppress-column-virtualisation="false"
          @grid-ready="onGridReady"
        />
      </div>

      <aside class="results">
        <h2>Recent benchmark events</h2>
        <table class="results-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Runs</th>
              <th>Last</th>
              <th>Median</th>
              <th>P95</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="result in benchmarkResults" :key="result.label">
              <td>{{ result.label }}</td>
              <td>{{ result.runs }}</td>
              <td>{{ result.lastMs.toFixed(1) }}</td>
              <td>{{ result.medianMs.toFixed(1) }}</td>
              <td>{{ result.p95Ms.toFixed(1) }}</td>
            </tr>
          </tbody>
        </table>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.page { font-family: Inter, -apple-system, sans-serif; height: 100vh; display: flex; flex-direction: column; margin: 0; }
.toolbar { padding: 10px 14px; border-bottom: 1px solid #e5e7eb; background: #fff; }
.toolbar h1 { margin: 0; font-size: 16px; }
.status { margin-top: 4px; color: #64748b; font-size: 12px; }
.controls { display: flex; gap: 8px; align-items: center; padding: 10px 14px; border-bottom: 1px solid #e5e7eb; background: #fafafa; }
.controls input { height: 30px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 4px; }
.controls button { height: 30px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 4px; background: white; cursor: pointer; }
.note { font-size: 12px; color: #64748b; }
.layout { min-height: 0; flex: 1; display: grid; grid-template-columns: 1fr 280px; }
.grid-host { min-height: 0; width: 100%; height: 100%; }
.ag-grid-component { width: 100%; height: 100%; display: block; }
.results { border-left: 1px solid #e5e7eb; padding: 12px; overflow: auto; }
.results h2 { margin: 0 0 8px; font-size: 13px; }
.results-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.results-table th, .results-table td { border-top: 1px solid #e5e7eb; padding: 6px 4px; text-align: left; }
</style>
