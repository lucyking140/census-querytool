import { Component, Input, NgModule, OnInit, Renderer2, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ParamSelectionService } from '../param-selection.service';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatIconModule} from '@angular/material/icon';

//for search bar
//import {MatInputModule} from '@angular/material/input';
//import {MatFormFieldModule} from '@angular/material/form-field';
import {FormsModule, FormControl, ReactiveFormsModule} from '@angular/forms';

//new search bar
import {map, startWith, debounceTime} from 'rxjs/operators';
import {AsyncPipe} from '@angular/common';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {Observable} from 'rxjs';

//for dialog display
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle
} from '@angular/material/dialog';
import { TemplateDialog, DialogData } from '../template-dialog/template-dialog.component';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

//for snackbar display
import {MatSnackBar} from '@angular/material/snack-bar';

@Component({
  selector: 'app-param-dropdown',
  standalone: true,
  imports: [
    CommonModule,
    MatSlideToggleModule,
    MatButtonToggleModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './param-dropdown.component.html',
  styleUrl: './param-dropdown.component.css'
})
export class ParamDropdownComponent {

  @Input() data:  any[]  = [];
  //for recursive dropdown styling
  @Input() level: number = 1;
  @Input() parentColor: string = '#cae9f7'; //fffff
  @Input() dataset: string = ""; //the endpoint that we're currently referencing (using in comm lvl handling)
  @Input() exports: boolean = false;
  @Input() paired_params: {[key: string]: string} = {};
  @Input() searchable_items: any[] = [];

  backgroundColor: string = "";
  //list tracking if an invalid commodity is selected for a chosen comm_lvl. displays an error
  invalidCommSelection: string[] = [];
  selectedCommLvls: string[] = []; //stores the lengths of comm_codes that are currently selected for COMM_LVL
  comm_category: string = "";

  //copied from data.service
  comm_lvl_commods: {[key: string]: string[]} = {
    "hs": ["E_COMMODITY", "I_COMMODITY"],
    "enduse": ["E_ENDUSE", "I_ENDUSE"],
    "hitech": [],
    "naics": ["NAICS"],
    "porths": ["E_COMMODITY", "I_COMMODITY"],
    "sitc": [],
    "statehs": ["E_COMMODITY", "I_COMMODITY"],
    "statenaics": ["NAICS"],
    "usda": [],
    "":[]
  };

  expandedCodes: Set<string> = new Set();
    
  constructor(private selectionService: ParamSelectionService, private el: ElementRef, private renderer: Renderer2, private _snackBar: MatSnackBar) {};

  ngOnInit(){
    this.backgroundColor = this.getDarkerColor(this.parentColor, this.level * 10);
    this.renderer.setStyle(this.el.nativeElement, '--level', this.level);
    this.selectionService.setPairedParams(this.paired_params);
    this.comm_category = this.comm_lvl_commods[this.dataset].length == 2 ? (this.exports ? this.comm_lvl_commods[this.dataset][0]: this.comm_lvl_commods[this.dataset][1]) : this.comm_lvl_commods[this.dataset][0];

    this.searchControl.valueChanges.pipe(
      debounceTime(300)
    ).subscribe(query => {
      this.search(query);
    });
  }

  // Checking for changes in the Paired param name/code toggles
  onPPTogleChange(type: string, category: string, value: boolean){
      console.log("New value for type category: ", type, category, value);
      this.selectionService.onPPToggleChange(type, category, value);
  }

  isPPIncluded(category: string, type: string): boolean {
      return this.selectionService.isPPIncluded(category, type);
  }

  // Currently only verifies Commodity level verification, e.g. if a commodity is selected and does not abide 
  // by the selected COMM_LVLs
  validParam(item: any){
    //console.log("Entered valid param for item: ", item);
      const category = item.category;
      const name = item.name;

      //comm code is involved
      if (this.isCategorySelected("COMM_LVL")){
        //we are looking at a commodity item (but not the overarching category)
        if (category == this.comm_category && name[0] != this.comm_category){ //item is a commodity code
          this.selectedCommLvls = this.selectionService.getSelectedCodes("COMM_LVL");
          //no values have been selected yet (just COMM_LVL in get string), so everything is valid
          if(this.selectedCommLvls.length == 0){
            return true;
          }

          if(name[0].indexOf('-') != -1){
            return false; //these cumulative options aren't ever valid for COMM_LVLS if a value is specified
          }
          
          const comm_lvl_lens = this.selectedCommLvls.map(comm => { return comm.slice(-1) }); //last char of first selected code
          //the current commodity is an invalid length
          if (!comm_lvl_lens.includes(name[0].length.toString())){
            //console.log("Selected comm_levels: ", comm_lvl_lens);
            //console.log("current len for item: ", name.length.toString(), name);
            if(this.isSelected(category, name)){ //we want user to be able to disable a selected incorrect param
                return true;
            }
            return false;
          }
        }
       
      }
      return true;
  }

  // Used to get the darker colors for subsequent dropdowns
  getDarkerColor(color: string, percent: number): string {
    let fact = this.level == 1 ? 0.4 : 0.2;
    let num = parseInt(color.slice(1), 16),
        amt = Math.round(fact * percent),  // Adjust the darkness increment as needed
        R = (num >> 16) & 0xFF,
        G = (num >> 8) & 0xFF,
        B = num & 0xFF;
  
    R = Math.max(0, R - amt);
    G = Math.max(0, G - Math.round(1 * amt));  // Less impact on green
    B = Math.max(0, B - Math.round(0.5 * amt));    // More impact on blue
  
    return `#${(R << 16 | G << 8 | B).toString(16).padStart(6, '0')}`;
  }

  // Opens/Closes the subsequent dropdowns
  toggleDropdown(code: string) {
    if (this.expandedCodes!.has(code[0])) {
      this.expandedCodes!.delete(code[0]);
    } else {
      this.expandedCodes!.add(code[0]);
    }
  }

  isCategorySelected(category: string): boolean{
    return this.selectionService.isCategorySelected(category);
  }

  isExpanded(code: string): boolean {
    return this.expandedCodes.has(code[0]);
  }

  isPairedParam(category: string): boolean{
      return Object.keys(this.paired_params).includes(category);
  }

  /**
   * Triggered whenever a param is selected.
   * Handles invalidComms (for COMM_LVL) by reevaluating them after each COMM_LVL var is selected
   * Also automatically adds description params for paired params (can be toggled)
   * @param category the category of the selected parameter, e.g. E_COMMODITY or AIR_VAL_MO
   * @param code the value of the selected param. Will be the same as category if the var was selected
   * with no value specified
   */
  toggleSelection(category: string, code:string){

    //this code has been invalidly selected, removing it because we are deselecting it
    if(this.invalidCommSelection.includes(code)){
      //console.log("REMOVING CODE: ", code);
      const ind = this.invalidCommSelection.indexOf(code);
      //console.log("Removal index: ", ind);
      this.invalidCommSelection.splice(ind, 1);
      //console.log("invalidComms after removal: ", this.invalidCommSelection)
      this.selectionService.setInvalidCodes(this.invalidCommSelection);
    }
    if(this.isCategorySelected("COMM_LVL")){
      //adding or removing a COMM_LVL
      if(category=="COMM_LVL"){
          //resetting entirely because we are de-selecting comm_lvl entirely
          if(code == "COMM_LVL" || (this.selectedCommLvls.length == 1 && this.selectedCommLvls[0] == code)){
            console.log("in clear section for category and code: ", category, code);
            this.selectedCommLvls = [];
            this.invalidCommSelection = [];
            this.selectionService.setInvalidCodes(this.invalidCommSelection);
          } else if (this.isSelected(category, code)){ //REMOVING a comm_lvl that is NOT the last one
            //console.log("removing ", category, code);
            //checking if any currently selected params are NOW invalid
            const cur_comms = this.selectionService.getSelectedCodes(this.comm_category);
            for(let comm of cur_comms){
              if(comm[0].length.toString() == code.slice(-1)){ //this commodity is the length of the code to be removed, thus was valid and is no longer
                  //console.log("invalid comm, length: ", comm[0], code.slice(-1));
                  this.invalidCommSelection.push(comm[0]);
              }
            }
            this.selectionService.setInvalidCodes(this.invalidCommSelection);
            const ind = this.selectedCommLvls.indexOf(code);
            this.selectedCommLvls.splice(ind, 1);
          } else { //ADDING a comm_lvl
              //console.log("adding: ", category, code);
              //checking if any currently invalid params are now valid
              for(let comm of this.invalidCommSelection){
                //console.log("Com, and comm.length.toString, and goal len: ", comm, comm.length.toString(), code.slice(-1));
                if(comm.length.toString() == code.slice(-1)){
                  //console.log("newly valid comm, length: ", comm, code.slice(-1));
                  const ind = this.invalidCommSelection.indexOf(comm);
                  this.invalidCommSelection.splice(ind, 1);
                }
              }
              //console.log("new set of invalid codes: ", this.invalidCommSelection);
              this.selectionService.setInvalidCodes(this.invalidCommSelection);
              this.selectedCommLvls.push(code)
          }
        }
    } else if(category == "COMM_LVL"){
      this.selectedCommLvls.push(code);
      //iterating through selected commodities and marking invalid ones as such
      const cur_comms = this.selectionService.getSelectedCodes(this.comm_category);
      for(let comm of cur_comms){
        if(comm[0].length.toString() != code.slice(-1)){ //this commodity is the length of the code to be removed, thus was valid and is no longer
            //console.log("invalid comm, length: ", comm[0], code.slice(-1));
            this.invalidCommSelection.push(comm[0]);
        }
      }
      this.selectionService.setInvalidCodes(this.invalidCommSelection);
      //console.log("entered first added comm_lvl. current invalid codes: ", this.invalidCommSelection);
    }

    //opening snack bar to show that a require co-param was added
    //only want to do this once
    if (Object.keys(this.paired_params).includes(category) && !this.isCategorySelected(category) && !this.isCategorySelected(this.paired_params[category])){
      let message = "Automatically added parameter " + this.paired_params[category] + " to query. Toggle off 'Include name' to remove.";
      this.openSnackBar(message, "Close");
    }

    if(category.indexOf("_LDESC") != -1  && !this.isCategorySelected(category) && !this.isCategorySelected(category.substring(0, category.indexOf("_LDESC")))){
      let message = "Automatically added commodity code " + category.substring(0, category.indexOf("_LDESC")) + " to query. This is required to query the long commodity description";
      this.openSnackBar(message, "Close");
    }

    this.selectionService.toggleSelection(category, code);
    
  }

  isSelected(category: string, code: string): boolean {
      return this.selectionService.isSelected(category, code);
  }

  getSelectedItems() : {[key:string] : string[] } {
    return this.selectionService.getSelectedItems();
  }

  /////// For top search bar /////////////
  searchControl = new FormControl('');
  current_options: any[] = [];
  cur_search: string = "";

  /**
   * Updates the current searchable options based on the given search string
   * @param e the current search string
   */
  search(e: any) {

    if (typeof e !== 'string'){
      return;
    }
    console.log("reaching search for term ", e);
    const val = e.toLowerCase();
    const temp = this.searchable_items.filter(x => {
      if ( !val || x['name'][0].toLowerCase().indexOf(val) == 0 || x['category'].toLowerCase().indexOf(val) != -1 || (x['name'][1] && x['name'][1].toLowerCase().indexOf(val) !== -1 )) {
        return x;
      }
    });
    this.current_options = temp;
  }

  /**
   * Trigged when an item that pops up in the search bar is selected
   * @param item Item that has been searched for
   */
  searchSelect(item: {[key: string] : string}) {
    this.searchControl.setValue(item['name']);
    console.log("Searching for: ", item['name']);
    this.selectionService.toggleSelection(item["category"], item["name"])
    //this.toggleSelectionDialog(true);
    const message = "Parameter " + item['name'][0] + " (" + item['category'] + ") has been added to the API call";
    this.openSnackBar(message, "Close");
  }

  trackByFn(index: number, item: any): any {
    return item.name || index;
  }

  readonly dialog = inject(MatDialog);
  dialogRef!: any;
  
  toggleSelectionDialog(val: boolean): void {
    
    if(val){
      this.dialogRef = this.dialog.open(TemplateDialog, {data: {type: "param_select"}});
      this.dialogRef.afterClosed().subscribe(() => {
        console.log('The dialog was closed');
      });
    } else {
      this.dialogRef.close();
    }
  }

  //for snack bar showing that a param has been added

  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action, {
      duration: 2000,
    });
  }

}
