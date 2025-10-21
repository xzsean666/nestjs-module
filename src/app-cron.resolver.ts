import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GraphQLJSON } from 'graphql-type-json';
import { AuthGuard, CurrentUser } from './auth/auth.guard.service';
import { AppCronService } from './app-cron.service';
import { CronManagerService } from './common_modules/cron/cron-manager.service';

@Resolver()
export class CronResolver {
  private cronManager: CronManagerService;

  constructor(private readonly appCronService: AppCronService) {
    this.cronManager = this.appCronService.getCronManager();
  }

  // @Mutation(() => GraphQLJSON)
  // @UseGuards(AuthGuard)
  // async manualRunTask(
  //   @CurrentUser() user: any,
  //   @Args('jobId', { type: () => String, defaultValue: 'main-task-runner' })
  //   jobId: string,
  // ) {
  //   return this.cronManager.manualExecuteJob(jobId);
  // }

  // @Query(() => GraphQLJSON)
  // @UseGuards(AuthGuard)
  // getTaskExecutionStatus(
  //   @CurrentUser() user: any,
  //   @Args('jobId', { type: () => String, nullable: true })
  //   jobId?: string,
  // ) {
  //   if (jobId) {
  //     return this.cronManager.getJobStatus(jobId);
  //   }
  //   return this.cronManager.getAllJobStatus();
  // }

  // @Mutation(() => GraphQLJSON)
  // @UseGuards(AuthGuard)
  // forceStopTask(
  //   @CurrentUser() user: any,
  //   @Args('jobId', { type: () => String })
  //   jobId: string,
  // ) {
  //   return this.cronManager.forceStopJob(jobId);
  // }

  // @Mutation(() => Boolean)
  // @UseGuards(AuthGuard)
  // resetTaskStats(
  //   @CurrentUser() user: any,
  //   @Args('jobId', { type: () => String, nullable: true })
  //   jobId?: string,
  // ) {
  //   if (jobId) {
  //     return this.cronManager.resetJobStats(jobId);
  //   } else {
  //     this.cronManager.resetAllStats();
  //     return true;
  //   }
  // }

  // @Mutation(() => Boolean)
  // @UseGuards(AuthGuard)
  // setJobEnabled(
  //   @CurrentUser() user: any,
  //   @Args('jobId', { type: () => String })
  //   jobId: string,
  //   @Args('enabled', { type: () => Boolean })
  //   enabled: boolean,
  // ) {
  //   return this.cronManager.setJobEnabled(jobId, enabled);
  // }

  // @Query(() => GraphQLJSON)
  // @UseGuards(AuthGuard)
  // getAllJobs(@CurrentUser() user: any) {
  //   return this.cronManager.getAllJobStatus();
  // }
}
