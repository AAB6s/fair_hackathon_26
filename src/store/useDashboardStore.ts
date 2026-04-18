import { create } from "zustand";
import type { Scenario, SystemState } from "../types";
import { buildSystemState, getPrimaryRegionId } from "../data/scenarios";

interface DashboardStore {
  state: SystemState;
  selectedRegionId: string;
  tickCount: number;
  startedAt: number;
  setScenario: (scenario: Scenario) => void;
  selectRegion: (regionId: string) => void;
  tick: () => void;
}

const initialScenario: Scenario = "high_pollution";
const initialStartedAt = Date.now();
const initialState = buildSystemState(initialScenario, 0, initialStartedAt);

export const useDashboardStore = create<DashboardStore>((set) => ({
  state: initialState,
  selectedRegionId: getPrimaryRegionId(initialState),
  tickCount: 0,
  startedAt: initialStartedAt,
  setScenario: (scenario) => {
    const startedAt = Date.now();
    const state = buildSystemState(scenario, 0, startedAt);

    set({
      state,
      selectedRegionId: getPrimaryRegionId(state),
      tickCount: 0,
      startedAt,
    });
  },
  selectRegion: (selectedRegionId) => set({ selectedRegionId }),
  tick: () =>
    set((store) => {
      const tickCount = store.tickCount + 1;
      const state = buildSystemState(store.state.scenario, tickCount, store.startedAt);

      return {
        state,
        tickCount,
      };
    }),
}));
