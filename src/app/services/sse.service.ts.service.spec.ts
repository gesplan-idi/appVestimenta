import { TestBed } from '@angular/core/testing';

import { SseServiceTsService } from './sse.service.ts.service';

describe('SseServiceTsService', () => {
  let service: SseServiceTsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SseServiceTsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
