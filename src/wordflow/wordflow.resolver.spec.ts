import { Test, TestingModule } from '@nestjs/testing';
import { WordflowResolver } from './wordflow.resolver';

describe('WordflowResolver', () => {
  let resolver: WordflowResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WordflowResolver],
    }).compile();

    resolver = module.get<WordflowResolver>(WordflowResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
