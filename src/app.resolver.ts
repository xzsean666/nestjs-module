import { Query, Resolver, ObjectType, Field } from '@nestjs/graphql';
import { DBService } from './common/db.service';
import { KVDatabase } from './helpers/sdk';
import { SupabaseAuthGuard, CurrentUser } from './common/supabase.service';
import type { User } from '@supabase/supabase-js';
import { UseGuards, CanActivate } from '@nestjs/common';
import { cacheFn } from './common/cache.service';
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
  @cacheFn(1 * 60 * 60)
  @UseGuards(SupabaseAuthGuard)
  currentUser(@CurrentUser() user: User) {
    return user;
  }
  @Query(() => String)
  @UseGuards()
  test() {
    return 'Hello World666';
  }
}
