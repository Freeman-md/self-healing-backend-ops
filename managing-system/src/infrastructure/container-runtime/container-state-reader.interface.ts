import type {
  ContainerRuntimeTarget,
  ContainerStateResult,
} from "./container-runtime.types";

export interface IContainerStateReader {
  inspectTarget(target: ContainerRuntimeTarget): Promise<ContainerStateResult>;
}
