import type { ContainerRestartResult, ContainerRuntimeTarget } from "./container-runtime.types";

export interface IContainerRuntime {
  restartTarget(target: ContainerRuntimeTarget): Promise<ContainerRestartResult>;
}
