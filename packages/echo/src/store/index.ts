import { configure } from "mobx";
import { RootStore } from "./root";

export const rootStore = RootStore.init();
export const useStore = () => RootStore.init();
configure({
  enforceActions: 'never' 
});
export { RootStore };

// 投资模块 Store
export { InvestmentStore } from "./investmentStore";
export type { Position, PriceAlert } from "./investmentStore";

// 便捷 Hook：获取 InvestmentStore 实例
export const useInvestmentStore = () => {
  const { InvestmentStore: InvestmentStoreClass } = require("./investmentStore");
  return RootStore.Get(InvestmentStoreClass);
};