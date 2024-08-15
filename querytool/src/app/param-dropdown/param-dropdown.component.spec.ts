import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParamDropdownComponent } from './param-dropdown.component';

describe('ParamDropdownComponent', () => {
  let component: ParamDropdownComponent;
  let fixture: ComponentFixture<ParamDropdownComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParamDropdownComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParamDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
