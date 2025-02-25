import {
  Args,
  Mutation,
  Query,
  Resolver,
  ObjectType,
  Field,
} from '@nestjs/graphql';
import { DBService } from './common/db.service';
import { KVDatabase } from './utils/PGKVDatabase';

@ObjectType()
export class KeyValue {
  @Field()
  key: string;

  @Field(() => JSON)
  value: any;
}

@Resolver(() => KeyValue)
export class AppResolver {
  private db: KVDatabase;
  constructor(private readonly dbService: DBService) {
    this.db = dbService.getDBInstance('test');
  }

  @Query(() => JSON, { nullable: true })
  async getValue(@Args('key') key: string) {
    return this.db.get(key);
  }

  @Mutation(() => Boolean)
  async setValue(
    @Args('key') key: string,
    @Args('value', { type: () => JSON }) value: any,
  ) {
    await this.db.put(key, value);
    return true;
  }

  @Mutation(() => Boolean)
  async deleteValue(@Args('key') key: string) {
    return this.db.delete(key);
  }

  @Query(() => [KeyValue])
  async searchValues(
    @Args('contains', { type: () => JSON, nullable: true }) contains?: object,
    @Args('limit', { type: () => Number, nullable: true }) limit?: number,
    @Args('cursor', { nullable: true }) cursor?: string,
  ) {
    const { data } = await this.db.searchJson({ contains, limit, cursor });
    return data.map((item) => ({
      key: item.key,
      value: item.value,
    }));
  }

  @Mutation(() => Boolean)
  async putManyValues(
    @Args('entries', { type: () => [[String, JSON]] })
    entries: Array<[string, any]>,
    @Args('batchSize', { type: () => Number, nullable: true })
    batchSize?: number,
  ) {
    await this.db.putMany(entries, batchSize);
    return true;
  }
}
