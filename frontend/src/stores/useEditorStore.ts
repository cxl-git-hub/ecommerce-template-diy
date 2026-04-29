import { create } from 'zustand';
import { Layer, LayerConfig } from '@/types';

interface EditorState {
  // 画布配置
  canvasWidth: number;
  canvasHeight: number;
  layers: Layer[];
  selectedLayerId: string | null;

  // 历史栈
  past: LayerConfig[];
  future: LayerConfig[];
  maxHistory: number;

  // 初始化
  setConfig: (config: LayerConfig) => void;
  getConfig: () => LayerConfig;

  // 图层操作
  addLayer: (layer: Layer) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, updates: Partial<Layer>) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  selectLayer: (layerId: string | null) => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;

  // 历史操作
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const createSnapshot = (state: EditorState): LayerConfig => ({
  width: state.canvasWidth,
  height: state.canvasHeight,
  layers: JSON.parse(JSON.stringify(state.layers)),
});

export const useEditorStore = create<EditorState>((set, get) => ({
  canvasWidth: 800,
  canvasHeight: 800,
  layers: [],
  selectedLayerId: null,
  past: [],
  future: [],
  maxHistory: 30,

  setConfig: (config) => {
    set({
      canvasWidth: config.width,
      canvasHeight: config.height,
      layers: JSON.parse(JSON.stringify(config.layers)),
      selectedLayerId: null,
      past: [],
      future: [],
    });
  },

  getConfig: () => {
    const state = get();
    return {
      width: state.canvasWidth,
      height: state.canvasHeight,
      layers: JSON.parse(JSON.stringify(state.layers)),
    };
  },

  addLayer: (layer) => {
    const state = get();
    state.pushHistory();
    set({ layers: [...state.layers, layer] });
  },

  removeLayer: (layerId) => {
    const state = get();
    state.pushHistory();
    set({
      layers: state.layers.filter((l) => l.id !== layerId),
      selectedLayerId: state.selectedLayerId === layerId ? null : state.selectedLayerId,
    });
  },

  updateLayer: (layerId, updates) => {
    const state = get();
    state.pushHistory();
    set({
      layers: state.layers.map((l) =>
        l.id === layerId ? ({ ...l, ...updates } as Layer) : l
      ),
    });
  },

  reorderLayers: (fromIndex, toIndex) => {
    const state = get();
    state.pushHistory();
    const newLayers = [...state.layers];
    const [moved] = newLayers.splice(fromIndex, 1);
    newLayers.splice(toIndex, 0, moved);
    set({ layers: newLayers });
  },

  selectLayer: (layerId) => set({ selectedLayerId: layerId }),

  toggleLayerVisibility: (layerId) => {
    const state = get();
    set({
      layers: state.layers.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } as Layer : l
      ),
    });
  },

  toggleLayerLock: (layerId) => {
    const state = get();
    set({
      layers: state.layers.map((l) =>
        l.id === layerId ? { ...l, locked: !l.locked } as Layer : l
      ),
    });
  },

  pushHistory: () => {
    const state = get();
    const snapshot = createSnapshot(state);
    const newPast = [...state.past, snapshot].slice(-state.maxHistory);
    set({ past: newPast, future: [] });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const previous = state.past[state.past.length - 1];
    const currentSnapshot = createSnapshot(state);
    set({
      canvasWidth: previous.width,
      canvasHeight: previous.height,
      layers: JSON.parse(JSON.stringify(previous.layers)),
      past: state.past.slice(0, -1),
      future: [currentSnapshot, ...state.future],
    });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[0];
    const currentSnapshot = createSnapshot(state);
    set({
      canvasWidth: next.width,
      canvasHeight: next.height,
      layers: JSON.parse(JSON.stringify(next.layers)),
      past: [...state.past, currentSnapshot],
      future: state.future.slice(1),
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
