export type ContainerRuntimeTarget = "managed-system" | "postgres";

export type ContainerRestartResult = {
  target: ContainerRuntimeTarget;
  containerName: string;
  output: string;
};
