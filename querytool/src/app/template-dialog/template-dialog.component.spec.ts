import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemplateDialog } from './template-dialog.component';

describe('ParamDropdownComponent', () => {
  let component: TemplateDialog;
  let fixture: ComponentFixture<TemplateDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemplateDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
