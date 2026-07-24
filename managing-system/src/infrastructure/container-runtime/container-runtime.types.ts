export type ContainerRuntimeTarget = "managed-system" | "postgres";

export type ContainerRestartResult = {
  target: ContainerRuntimeTarget;
  containerName: string;
  output: string;
};

export type ContainerState = "running" | "stopped" | "exited" | "restarting" | "unknown";

export type ContainerStateResult = {
  target: ContainerRuntimeTarget;
  containerName: string;
  state: ContainerState;
};
