import {ChangeDetectionStrategy, Component, inject, model, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';


import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';

import { MatProgressSpinnerModule, ProgressSpinnerMode } from '@angular/material/progress-spinner';  


export interface DialogData {
    type: string,
    message: string
  }


@Component({
    selector: 'app-template-dialog',
    templateUrl: './template-dialog.component.html',
    styleUrl: './template-dialog.component.css',
    standalone: true,
    imports: [
      MatFormFieldModule,
      MatInputModule,
      FormsModule,
      MatButtonModule,
      MatDialogTitle,
      MatDialogContent,
      MatDialogActions,
      MatDialogClose,
      MatProgressSpinnerModule,
      CommonModule
      
    ],
  })

  export class TemplateDialog {

    mode: ProgressSpinnerMode = 'indeterminate';
    showMessage: boolean = false;
    errorButton: string = "Show full error message";

    readonly data = inject<DialogData>(MAT_DIALOG_DATA);
    readonly type = this.data.type; //model(this.data.type);
    readonly message = this.data.message;


    dialogRef = inject(MatDialogRef<TemplateDialog>);
  
    onNoClick(): void {
      this.dialogRef.close();
    }

    toggleMessageOn() {
      if(!this.showMessage){
        this.showMessage = true;
        this.errorButton = "Hide full error message";
      } else{
        this.showMessage = false;
        this.errorButton = "Show full error message";
      }
    }
  }