export interface IRepository<TEntity, TCreateInput, TUpdateInput> {
  create(input: TCreateInput): Promise<TEntity>;
  update(id: string, input: TUpdateInput): Promise<TEntity | null>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<TEntity | null>;
  findAll(): Promise<TEntity[]>;
}
