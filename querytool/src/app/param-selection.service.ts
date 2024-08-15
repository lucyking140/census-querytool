import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ParamSelectionService {

  constructor() { }

  private selectedCodes: {[key: string]: Set<string> } = {}; //code : {[sub code], [sub code], ...}
  private selectionChangedSubject = new BehaviorSubject<{[key: string]:string[]}>({});
  public selectionChanged$ = this.selectionChangedSubject.asObservable();

  private invalidChangedSubject = new BehaviorSubject<any[]>([]);
  public invalidChanged$ = this.invalidChangedSubject.asObservable();
  private invalidCodes: any[] = [];

  //for handling name-code toggles for paired params
  paired_params: {[key: string]: string} = {};
  excludedNames: string[] = [];
  excludedCodes: string[] = [];

  //name-code toggle methods
  setPairedParams(params:  {[key: string]: string}){
    if (Object.keys(params).length > 0){
      this.paired_params = params;
      console.log("Setting paired params: ", this.paired_params)
    }
  }
  
  onPPToggleChange(type: string, category: string, value: boolean){

    //updating excludedNames list
    if(type == 'name'){
      //the category is already included --> remove it
      if(this.excludedNames.includes(category)){
        const ind = this.excludedNames.indexOf(category)
        this.excludedNames.splice(ind, 1);
      } else { //it does not already included --> add it
        this.excludedNames.push(category);
      }
    } else if(type == 'code'){
      //the category is already included --> remove it
      if(this.excludedCodes.includes(category)){
        const ind = this.excludedNames.indexOf(category)
        this.excludedCodes.splice(ind, 1);
      } else { //it does not already included --> add it
        this.excludedCodes.push(category);
      }
    }
    console.log(this.excludedCodes, this.excludedNames);
    console.log(this.selectedCodes);

    /*
    - get selected params for this parameter
    - change them to remove/add either the value of key of the paired param
    - then handle the searched vals: should be able to swap the first string with the second (this will 
    appy regardess of we're added or deleting)
    */
    const name_param = this.paired_params[category];
    console.log("name_param in toggle change: ", this.paired_params, category, name_param);

    //invalid-- error message will show
    if(this.excludedNames.includes(category) && this.excludedCodes.includes(category)){
      this.notifySelectionChanged();
      return;
    } 

    if(type == 'name'){
      //ADDING the name val
      if(value == true){
        //adding the name parameter to selectedCodes
        if(!this.selectedCodes[name_param]){
          this.selectedCodes[name_param] = new Set();
        }
      } else { //REMOVING the name val
        
        //changing any selections to code instead of name
        for(const sel of this.selectedCodes[name_param]){
          //getting FIRST string, later used in the API
          /*
          console.log("original string: ", sel);
          const code = sel.substring(0, sel.indexOf(","));
          const end_second = sel.indexOf(",", sel.indexOf(","));
          const name = sel.substring(code.length, end_second);
          const first_half = name.concat(",", name)
          const new_string: string = first_half.concat(",", sel.substring(end_second, sel.length));
          console.log("New string: ", new_string);
          */
          this.selectedCodes[category].add(sel);
        }

        //removing the category itself
        if(this.selectedCodes[name_param]){
          delete this.selectedCodes[name_param];
        }
      }
    } 

    if(type == 'code'){
      //ADDING the code val
      if(value == true){
        //adding the code parameter to selectedCodes
        if(!this.selectedCodes[category]){
          this.selectedCodes[category] = new Set();
        }

        //IF we are currently querying by name, CHANGE to by code
        if (this.selectedCodes[name_param]){
          for(const sel of this.selectedCodes[name_param]){
            this.selectedCodes[category].add(sel);
          }
          this.selectedCodes[name_param] = new Set(); //clearing these
        }

      } else { //REMOVING the code val
        
        //changing any selections to code instead of name
        console.log("selected codes in general: ", this.selectedCodes);
        console.log("Category in code off: ", category, this.selectedCodes[category]);
        for(const sel of this.selectedCodes[category]){
          console.log("sel in for loop: ", sel);
          //getting FIRST string, later used in the API
          /*
          console.log("original string: ", sel);
          const code = sel.substring(0, sel.indexOf(","));
          const end_second = sel.indexOf(",", sel.indexOf(","));
          const name = sel.substring(code.length, end_second);
          const first_half = name.concat(",", name)
          const new_string: string = first_half.concat(",", sel.substring(end_second, sel.length));
          console.log("New string: ", new_string);
          */
          this.selectedCodes[name_param].add(sel);
        }
        console.log("selectedCodes[name_param] after adding all cats: ", name_param, this.selectedCodes[name_param]);
        this.selectedCodes[category] = new Set(); //resetting this to by empty
        //This must be here to query by name -- (removing the category itself)
        /*
        if(this.selectedCodes[category]){
          delete this.selectedCodes[category];
        }
        */
      }
    }
    console.log("Reaching notification");
    this.notifySelectionChanged();

  }

  isPPIncluded(category: string, type: string): boolean {
    if(type == 'name'){
      return !this.excludedNames.includes(category);
    } else {
      return !this.excludedCodes.includes(category);
    }

    /*
    //neither selected, or 
    if(type == 'name'){
      return !(!this.selectedCodes[this.paired_params[category]] && this.selectedCodes[category]);
      //return (!this.selectedCodes[this.paired_params[category]] && !this.selectedCodes[category]) || (this.selectedCodes[this.paired_params[category]] ? true : false);
    } else {
      // the parameter overall has been selected (so paired param is selected), but code has been removed
      //return  (!this.selectedCodes[this.paired_params[category]] && !this.selectedCodes[category]) || this.selectedCodes[this.paired_params[category]] && !this.selectedCodes[category];
      return !(this.selectedCodes[this.paired_params[category]] && !this.selectedCodes[category])
    }
      */
  }

  getExcludedPPCategories(): any[] {
    return [this.excludedNames, this.excludedCodes];
  }

  toggleSelection(category: string, code:string){
    //console.log("reaching toggle selection for cateogry and code: ", category, code, code[0]);
    let hasCode = false;
    
    if (!this.selectedCodes[category]){
      //console.log("adding category")
      this.selectedCodes[category] = new Set();
      //adding selected code for paired params
      //POPUP
      if (this.paired_params[category] && !this.selectedCodes[this.paired_params[category]]){
        this.selectedCodes[this.paired_params[category]] = new Set();
      }

      //handling LDESC case
      if(category.indexOf("_LDESC") != -1){
        //add the corresponding code!
        const codeString = category.substring(0, category.indexOf("_LDESC"));
        console.log("Code string in LDESC toggle ", codeString)
        if(!this.selectedCodes[codeString]){
          this.selectedCodes[codeString] = new Set();
        }
      }

    } else { //the category does exist
      if (this.selectedCodes[category].has(code)) {
        this.selectedCodes[category].delete(code);
        hasCode = true
      }  else if (this.paired_params[category] && this.selectedCodes[this.paired_params[category]] && this.selectedCodes[this.paired_params[category]].has(code)){ //removing paired_params codes
        this.selectedCodes[this.paired_params[category]].delete(code);
        hasCode = true
      } else if (category == code[0]) { // case where the category has been selected, but it is not unselected and there are no codes in it
        delete this.selectedCodes[category]; 
        // removing the paired param
        if (this.paired_params[category]){
          delete this.selectedCodes[this.paired_params[category]]; 
        }
      }
    }

    //cat exists and we need to add the code
    //added hasCode var to not re-add the code that was removed above
    if (this.selectedCodes[category] && category != code[0] && !hasCode) { //checking to make sure we're not adding the cat itself
      //we're querying by name, not code, for this category
      if(this.excludedCodes.includes(category)){
        this.selectedCodes[this.paired_params[category]].add(code);
      } else {
        this.selectedCodes[category].add(code); //code[0]
      }
      
    }

    this.notifySelectionChanged();
  }

  isSelected(category: string, code: string): boolean {
    
      if (this.selectedCodes[category]) {
        if (category === code[0] || this.selectedCodes[category].has(code)){//code[0]
          return true;
        }
      } 
      if (this.paired_params[category] && this.selectedCodes[this.paired_params[category]]){
        if (this.selectedCodes[this.paired_params[category]].has(code)){//code[0]
          return true;
        }
      }

      return false;
      //return this.selectedCodes[category] && this.selectedCodes[category].has(code);
  }

  //returns the code selected for a given category, if it exists
  getSelectedCodes(category: string): string[] {
    return Array.from(this.selectedCodes[category] ? this.selectedCodes[category] : []);
  }

  getSelectedItems() : {[key:string] : string[] } {
    const result: { [key:string] : string[] } = {};
    for (const category in this.selectedCodes){
      result[category] = Array.from(this.selectedCodes[category]);
    }
    return result;
  }

  isCategorySelected(cat: string){
    return this.selectedCodes[cat]? true : false;
  }

  private notifySelectionChanged() {
    this.selectionChangedSubject.next(this.getSelectedItems());
  }

  private notifyInvalidSelectionChanged() {
    this.invalidChangedSubject.next(this.getInvalidCodes());
  }

  clearSelection() {
    this.selectedCodes = {};
    this.notifySelectionChanged();
  }

  setInvalidCodes(codes: any[]){
    this.invalidCodes = codes;
    this.notifyInvalidSelectionChanged();
  }

  getInvalidCodes(): any[] {
    return this.invalidCodes;
  }

}
