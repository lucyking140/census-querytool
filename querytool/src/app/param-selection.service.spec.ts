import { TestBed } from '@angular/core/testing';

import { ParamSelectionService } from './param-selection.service';

describe('ParamSelectionService', () => {
  let service: ParamSelectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ParamSelectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
