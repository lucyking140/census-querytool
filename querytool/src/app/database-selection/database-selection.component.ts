//General imports
import { Component, ViewChild, ElementRef, Renderer2, ChangeDetectionStrategy, inject, model, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { combineLatest, merge } from 'rxjs';
//Imports for parameter collection via forms (inital params and dropdown)
import { FormsModule, FormControl, FormGroup, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import {MatIconModule} from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule, ProgressSpinnerMode } from '@angular/material/progress-spinner'; 
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatRadioModule} from '@angular/material/radio'; 
//Imports used to implement parameter selection dropdown
import { ParamDropdownComponent } from '../param-dropdown/param-dropdown.component';
import { ParamSelectionService } from '../param-selection.service';
//General tool to make API calls, deal with data processing, etc.
import { DataService } from '../data/data.service';
//Imports for data table display
import {MatTableModule, MatTableDataSource} from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { PageEvent, MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
//validators
import { endAfterStart, startBeforePresent } from '../param-checks.validator';
//for dialog display (error messages and loading)
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { TemplateDialog, DialogData } from '../template-dialog/template-dialog.component';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';



@Component({
  selector: 'app-database-selection',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule, 
    MatIconModule,
    MatCheckboxModule,
    MatListModule,
    ParamDropdownComponent,
    MatTableModule,
    MatSortModule, 
    MatPaginatorModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTooltipModule,
    MatRadioModule
  ],
  providers: [
    {
      provide: MatDialogRef,
      useValue: {}
    } 
  ],
  templateUrl: './database-selection.component.html',
  styleUrl: './database-selection.component.css',
})

export class DatabaseSelectionComponent {

  @ViewChild(ParamDropdownComponent) param_dropdown!: ParamDropdownComponent;
  @ViewChild(MatPaginator, {static: false}) paginator!: MatPaginator;
  @ViewChild(MatSort, {static: true}) sort!: MatSort;

  initial_params: FormGroup;

  constructor(private fb: FormBuilder, private renderer: Renderer2, private el: ElementRef, private dataService: DataService, private selectionService: ParamSelectionService, private _snackBar: MatSnackBar) {
    this.initial_params = this.fb.group({
        exports: [{value: false, disabled: false}],
        imports: [{value: false, disabled: false}],
        time: [{value: false, disabled: false}],
        database: ['', Validators.required],
        start: ['', Validators.required],
        end: ['', Validators.required]
      }, {validator: [endAfterStart(), startBeforePresent()]})
  }

  param_list = new FormControl([""]) //list

  databases: string[] = []; //reps the list of ALL databases for display
  all_params_codes: string[]= [];
  all_params_names: string[]= [];
  paired_params: {[key: string]:string} = {};
  flat_search_params: string[] = []; //long list of all params (not tiered) to use in the search bar

  hasDatasetChanged: boolean = false; //if the dataset selection has changed, to trigger re-submitting initial params
  isExportsUpdating: boolean = false; //when export/import checkbox is updating
  readyForTable: boolean = false; //when query has been completed and data collected
  areParamsCollecting: boolean = false; //when all params are collected from API
  isQueryProcessing: boolean = false; //for when query has been submitted to the API but not yet returned
  areParamsValid: boolean = true; //tracking invalid params, mostly for comm_lvl
  readyForTableDisp: string = "none"; //Either "flex" for true or "none" for false -- handles bug with angular table not working with *ngIf
  isDatabaseDrop: boolean = false; //if database selection dropdown is shown
  isExportDrop: boolean = false; //same as above for export dropdown

  apiCall: string = ""; //accumulates params for final submission to the trade API

  //stores the data (returned from the apiCall query) + other needs
  table_columns: any[] = [];
  dataSource!: MatTableDataSource<any>;


  ngOnInit(){

      this.onStartChanges();

      try {
        this.paired_params = this.dataService.getPairedParams();
      }catch (error: any) {
        this.toggleErrorDialog(true, error);
      }

      //setting up the toggle to trigger dataset collection
      this.initial_params.get('exports')?.valueChanges.subscribe((exp) => {
        this.dataService.getAllDatasets(exp).subscribe(data => { 
          this.databases = data; 
          this.initial_params.get('database')?.setValue('');
        });
      }, (error) => {
        this.toggleErrorDialog(true, error);
      });

      //setting up exporting handling
      this.exportTable.valueChanges.subscribe(() =>{
          this.handleExport();
      });

      //re-collecting parameters whenever the database entry changes
      this.initial_params.get('database')?.valueChanges.subscribe(() => {
        this.hasDatasetChanged = true;
        this.all_params_names = []; //resestting params when dataset changes to avoid invalid params
        this.selectionService.clearSelection(); //removing all previously selected vars from the API
        this.dataSource = new MatTableDataSource(['']); //clearing the data table
        this.table_columns = [];
      })

      //tracking if invalid parameters have been selected to trigger a notification
      this.selectionService.invalidChanged$.subscribe((invalidList) => {
            if(this.areParamsValid && invalidList.length > 0){
                this.areParamsValid = false;
            } else if(!this.areParamsValid && invalidList.length == 0){
              this.areParamsValid = true;
            }
      });

      //initializing the apiCall to track any change to param selections
      combineLatest([
          this.initial_params.valueChanges,
          this.selectionService.selectionChanged$
      ]).subscribe(([formValues, selectedItems]) => {
          this.apiCall = this.dataService.formatApiCall(formValues, selectedItems);
      }, (error) => {
        this.toggleErrorDialog(true, error);
      });

      try {
        this.apiCall = this.dataService.formatApiCall(this.initial_params.value, this.selectionService.getSelectedItems());
      }catch (error: any) {
        this.toggleErrorDialog(true, error);
      }
  }

  ngAfterViewInit(){
    this.dataSource.paginator = this.paginator;
  }

  /**
   * Defaults the "end" time value to whatever is entered as the start
   */
  onStartChanges(){
    this.initial_params.get('start')!.valueChanges.subscribe( start => {
        //only setting end if it hasn't been previously
        if(start && !this.initial_params.get('end')?.value){
          this.initial_params.get('end')!.setValue(start, {emitEvent: false});
        }
    });
  }

  setDatabase(item: string){
    this.initial_params.get('database')?.setValue(item);
    this.isDatabaseDrop = false;
  }

  toggleDatabaseDrop(){
    this.isDatabaseDrop = !this.isDatabaseDrop;
  }

  /**
   * for getting params from the API after the initial form is filled out
   * data service --> flask API --> gets options for every possible param
   */
  onInitialSubmit() {
    console.log("Reaching initial submit");
    this.areParamsCollecting = true;
    //turn on loader
    this.toggleLoadingDialog(true);
    this.hasDatasetChanged = false; //re-setting the check if we need to re-accumulate params
    this.errorClosed = false; //re-setting this so it only applies once
    this.dataService.getAllParams(this.initial_params.value).subscribe((data:any[]) => {
      let [params, search_params] = data;
      this.all_params_names = params;
      this.flat_search_params = search_params;
      //console.log("flat search params in db component: ", this.flat_search_params);
      this.areParamsCollecting = false;
      //turn off loader
      this.toggleLoadingDialog(false);
    }, (error) => {
      this.toggleErrorDialog(true, error);
      this.toggleLoadingDialog(false);
    });
    
  }

  /**
   * for submitting to trade API after all params have been selected
   */
  submitQuery() {
    this.isQueryProcessing = true;
    this.toggleLoadingDialog(true)
    const [excludedNames, excludedCodes] = this.selectionService.getExcludedPPCategories();
    this.dataService.submitQuery(this.apiCall, this.initial_params.get('start')?.value, this.initial_params.get('end')?.value).subscribe(data=> {
      console.log("Raw returned data table: ", data);
      this.table_columns = [... new Set(Object.keys(data[0]))];//[... new Set(data[0])];//data[0];
      this.dataSource = new MatTableDataSource(data);
      this.dataSource.sort = this.sort;
      this.dataSource.paginator = this.paginator;
      this.readyForTable = true;
      this.readyForTableDisp = "flex";
      //console.log("data[0]: ", data[0])
      this.isQueryProcessing = false;
      this.toggleLoadingDialog(false)
    }, (error) => {
      this.toggleErrorDialog(true, error);
      this.toggleLoadingDialog(false);
    });

  }

  /////// Table exporting //////////

  exportTable = new FormControl("") //list

  setExportType(item: string){
    this.exportTable.setValue(item);
    //this.isExportDrop = false;
  }

  toggleExportDrop(){
    this.isExportDrop = !this.isExportDrop;
  }

  handleExport(){
    if(this.exportTable.value! == "CSV"){
        //console.log("reached export CSV case");
        this.exportTableCSV();
    } else if (this.exportTable.value! == "Excel"){
      this.exportTableExcel();
    } else if (this.exportTable.value! == "JSON"){
      this.exportTableJson();
    } 
  }

  exportTableCSV() {
    //console.log("reached export CSV case IN function");
    try {
      this.dataService.exportTableCSV(this.dataSource, this.table_columns);
    } catch(error: any) {
      this.toggleErrorDialog(true, error);
    }
   
  }

  exportTableExcel() {
    try {
      this.dataService.exportTableExcel(this.dataSource);
    } catch(error: any) {
      this.toggleErrorDialog(true, error);
    }
  }

  exportTableJson() {
    try {
      this.dataService.exportTableJson(this.dataSource);
    } catch(error: any) {
      this.toggleErrorDialog(true, error);
    }
  }

  /////// Paginator Stuff for data table ///////////

  length = 50;
  pageSize = 10;
  pageIndex = 0;
  pageSizeOptions = [5, 10, 25];

  hidePageSize = false;
  showPageSizeOptions = true;
  showFirstLastButtons = true;
  disabled = false;

  pageEvent!: PageEvent;

  handlePageEvent(e: PageEvent) {
    this.pageEvent = e;
    this.length = e.length;
    this.pageSize = e.pageSize;
    this.pageIndex = e.pageIndex;
  }

  setPageSizeOptions(setPageSizeOptionsInput: string) {
    if (setPageSizeOptionsInput) {
      this.pageSizeOptions = setPageSizeOptionsInput.split(',').map(str => +str);
    }
  }

  //////// for loading spinner ////////

  mode: ProgressSpinnerMode = 'indeterminate';

  ////////// for error/loading dialogs //////////

  l_dialog = inject(MatDialog);
  e_dialog = inject(MatDialog);
  loadingDialogRef!: any;
  errorDialogRef!: any;
  hasError: boolean = false;
  hasLoadingDialog: boolean = false;
  errorClosed: boolean = false; //used to re-activate param search when there's an error
  
  toggleLoadingDialog(val: boolean): void {
    
    if(val){
      this.loadingDialogRef = this.l_dialog.open(TemplateDialog, {data: {type: "loading"}, disableClose: true});
      this.hasLoadingDialog = true;
      this.loadingDialogRef.afterClosed().subscribe(() => {
        console.log('The LOADING dialog was closed');
        this.hasLoadingDialog = false;
      });
    } else {
      this.loadingDialogRef.close();
    }
  }

  toggleErrorDialog(val: boolean, message: string) {

    if(val){
      this.errorDialogRef = this.e_dialog.open(TemplateDialog, {data: {type: "error", message: message}, disableClose: true});
      this.errorDialogRef.afterClosed().subscribe(() => {
        console.log('The ERROR dialog was closed');
        this.hasError = false;
        this.errorClosed = true;
        if(this.hasLoadingDialog){
          console.log("Value of hasError at toggleLoader: ", this.hasError);
          this.toggleLoadingDialog(false);
        }
        
      });
    } else {
      this.errorDialogRef.close();
    }

  }

  /////// For resizing the navbar //////////

  private resizing = false;
  private navbarElement!: HTMLElement;
  sideBarWidth = 400;//this.navbarElement.getBoundingClientRect().left; //getting initial width of the sidebar
  private startX!: number;
  private startWidth!: number;
  
  startResizing(event: MouseEvent, navbar: HTMLElement): void {
    event.preventDefault();
    this.resizing = true;
    this.navbarElement = navbar;
    this.startX = event.clientX;
    this.startWidth = this.sideBarWidth;
    this.renderer.listen('document', 'mousemove', this.resize.bind(this));
    this.renderer.listen('document', 'mouseup', this.stopResizing.bind(this));
  }

  private resize(event: MouseEvent): void {
    if (this.resizing) {
      const addedWidth = event.clientX - this.startX; //event.clientX - this.navbarElement.getBoundingClientRect().left;
      const newWidth = this.startWidth + addedWidth;
      if (newWidth >= 250 && newWidth <= window.innerWidth - 100) {
        this.sideBarWidth = newWidth;
      }
    }
  }

  private stopResizing(): void {
    this.resizing = false;
  }

  copyText(str: string) {
    navigator.clipboard.writeText(str);
    this.openSnackBar("API call copied to clipboard", "Close");
  }

  //for snack bar showing that string has been copied
  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action, {
      duration: 2000,
    });
  }


}
