import { Query, Resolver, ObjectType, Field } from '@nestjs/graphql';
import { DBService } from './common/db.service';
import { KVDatabase } from './sdk/index';
import { SupabaseAuthGuard, CurrentUser } from './common/supabase.service';
import type { User } from '@supabase/supabase-js';
import { UseGuards } from '@nestjs/common';
import { cacheFn } from './common/cache.service';
@ObjectType()
export class KeyValue {
  @Field()
  key: string;

  @Field(() => JSON)
  value: any;
}

@Resolver(() => KeyValue)
@UseGuards(SupabaseAuthGuard)
export class AppResolver {
  private db: KVDatabase;
  constructor(private readonly dbService: DBService) {
    this.db = dbService.getDBInstance('test');
  }
  @Query(() => JSON, { nullable: true })
  @cacheFn(1 * 60 * 60)
  currentUser(@CurrentUser() user: User) {
    return user;
  }
}
