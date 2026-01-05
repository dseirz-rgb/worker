import { configure } from "mobx";
import { RootStore } from "./root";
import { InvestmentStore as InvestmentStoreClass } from "./investmentStore";
import { InvestmentNotesStore as InvestmentNotesStoreClass } from "./investmentNotesStore";

export const rootStore = RootStore.init();
export const useStore = () => RootStore.init();
configure({
  enforceActions: 'never' 
});
export { RootStore };

// 投资模块 Store
export { InvestmentStore } from "./investmentStore";
export type { Position, PriceAlert } from "./investmentStore";

// 投资笔记 Store
export { InvestmentNotesStore } from "./investmentNotesStore";

// 便捷 Hook：获取 InvestmentStore 实例
export const useInvestmentStore = () => {
  return RootStore.Get(InvestmentStoreClass);
};

// 便捷 Hook：获取 InvestmentNotesStore 实例
export const useInvestmentNotesStore = () => {
  return RootStore.Get(InvestmentNotesStoreClass);
};