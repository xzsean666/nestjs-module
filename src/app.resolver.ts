import { Query, Resolver, ObjectType, Field, Args } from '@nestjs/graphql';
import { DBService } from './common/db.service';
import { KVDatabase } from './helpers/sdk';
// import { SupabaseAuthGuard, CurrentUser } from './common/supabase.service';
import { UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './common/admin_auth';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class KeyValue {
  @Field()
  key: string;

  @Field(() => GraphQLJSON)
  value: any;
}

@Resolver(() => KeyValue)
export class AppResolver {
  private db: KVDatabase;
  constructor(private readonly dbService: DBService) {
    this.db = dbService.getDBInstance('test');
  }
  // @Query(() => JSON, { nullable: true })
  // @UseGuards(SupabaseAuthGuard)
  // @cacheFn(1 * 60 * 60)
  // currentUser(@CurrentUser() user: User) {
  //   return user;
  // }

  @Query(() => String)
  @UseGuards()
  test() {
    return 'Hello World666';
  }
  @Query(() => String)
  @UseGuards(AdminAuthGuard)
  testadmin() {
    return 'Hello admin';
  }
}
