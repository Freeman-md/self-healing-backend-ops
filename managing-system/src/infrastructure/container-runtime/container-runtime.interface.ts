import type {
  ContainerRestartResult,
  ContainerRuntimeTarget,
  ContainerStateResult,
} from "./container-runtime.types";

export interface IContainerRuntime {
  restartTarget(target: ContainerRuntimeTarget): Promise<ContainerRestartResult>;
  inspectTarget(target: ContainerRuntimeTarget): Promise<ContainerStateResult>;
}
