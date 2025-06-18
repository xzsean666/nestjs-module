import { Test, TestingModule } from '@nestjs/testing';
import { WordflowService } from './wordflow.service';

describe('WordflowService', () => {
  let service: WordflowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WordflowService],
    }).compile();

    service = module.get<WordflowService>(WordflowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
