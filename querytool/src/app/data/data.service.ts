import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Observable, firstValueFrom, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import {MatTableModule, MatTableDataSource} from '@angular/material/table';
import * as XLSX from 'xlsx';
import { isDataSource } from '@angular/cdk/collections';
import { UntypedFormArray } from '@angular/forms';

@Injectable({providedIn: 'root'})
export class DataService {
    
    constructor(private http: HttpClient) {}
    
    apiUrl = "https://api.census.gov/data/timeseries/intltrade/";

    //List of params that has a corresponding description (copied from app.py in the flask API)
    paired_params: {[key: string]: string} = {
        "CTY_CODE": "CTY_NAME",
        "DISTRICT":"DIST_NAME",
        "E_COMMODITY": "E_COMMODITY_SDESC",
        "E_ENDUSE": "E_ENDUSE_SDESC",
        "PORT": "PORT_NAME",
        "HITECH": "HITECH_DESC",
        "NAICS" : "NAICS_SDESC",
        "SITC" : "SITC_SDESC",
        "I_ENDUSE": "I_ENDUSE_SDESC",
        "I_COMMODITY": "I_COMMODITY_SDESC"
    };

    comm_lvl_commods: {[key: string]: string[]} = {
        "hs": ["E_COMMODITY", "I_COMMODITY"],
        "enduse": ["E_ENDUSE", "I_ENDUSE"],
        "hitech": [],
        "naics": ["NAICS"],
        "porths": ["E_COMMODITY", "I_COMMODITY"],
        "sitc": [],
        "statehs": ["E_COMMODITY", "I_COMMODITY"],
        "statenaics": ["NAICS"],
        "usda": []
    };

    /**
     * Used whenever any error is triggered. Accounts 
     * for the various types of errors thrown and
     * differentiates between Trade API errors and
     * this service's errors
     */
    handleError(e: HttpErrorResponse){
        let message = "";
        let code = "";
        if(e.status == 204){
            //This is the case if the API call returned no results (not invalid)
            //console.log("Reaching 204 case in handleError");
            message = e.message;
        } else {
            //console.log("Error in handleError of data service: ", e.error.error, e.message, e.error.message);
            if(e.error instanceof ErrorEvent){
                message = `Error: ${e.error.message}`;
            } else {
                code = e.error.error ?  e.error.error : "";
                if(code == ""){
                    code = e.message ?  e.message : "Unknown error occured";
                }
                if(code.includes("api.census.gov")){ // the error is with accessing the Trade API
                    code = "Error accessing Census API. Check to ensure query is valid: " + code;
                } else if (e.status == 0){ // Something has gone wrong in accessing the Flask API in the first place
                    //This doesn't have to be removed but it does prevent the URL of the API from being public
                    code = "Error while processing data: cannot access processing API";
                }

                message = `Error code: ${e.status}\nMessage: ${code}`;
            }
        }
        
        return throwError(message);
    }

    /**
     * Retrieves all databases for either imports or exports
     * @param exports
     * @returns a list of database names
     */
    getAllDatasets(exports: string | null): Observable<any[]> {
        //const exp = (exports == true ? "exports" : "imports");
        return this.http.get<any>((this.apiUrl+exports)).pipe(map (response => response.dataset.map((db: any) => 
            db.c_dataset[3]).filter((item: string) => 
                !item.includes("import") && !item.includes("export"))), 
                catchError(this.handleError)
            );
    }

    /**
     * Takes in the initial params and returns a JSON representing all possible variables,
     * with all options for each one
     * @param exports boolean val true for exports, false for imports
     * @param endpt actual database used, e.g. hs
     * @param start YEAR-MO start time
     * @param end YEAR-MO end time
     * @returns a JSON object containing the fully-processed list of parameters in the form
     * of a list of {name, category, options} dicts. 
     * name is the response [code, desc]
     * category is the high-level param that the item fits under (e.g. for "1XXX north america", 
     * cat is "CTY_CODE")
     * options is a list of {name, category, options} objects that reps all options for that param
     * (this supports tiered parameters like commodities)
     */
   /*getAllParams(exports: boolean | null, endpt: string | null, start : string, end: string): Observable<any[]> { */
    getAllParams(formValues: any): Observable<any[]> {
        const endpt = formValues.database;
        const exports = formValues.exports;
        const imports = formValues.imports;
        const start = formValues.start;
        const end = formValues.end;

        //make call to flask API
        let flask_url = "http://127.0.0.1:5000/all_params?dataset=" + endpt + "&exports=" + exports + "&start=" + start + "&end=" + end;
        return this.http.get<any>(flask_url).pipe(
            map( response => response ),
            catchError(this.handleError)
        );

   }

   /**
    * Returns the direct results of the apiCall to the trade API.
    * For multi-year queries, removes the months/years that are not included between
    * start and end.
    * @param apiCall the fully-formatted trade API call
    * @param start time to start
    * @param end time to end
    * @returns the JSON object representing the result
    */
   submitQuery(apiCall: string, start: string | null, end: string | null): Observable<any> {
    let resp: any[] = [];

    console.log("API endpoint: ", apiCall);
    return this.http.get<any>(apiCall, {observe: 'response' }).pipe( 
        map((response: HttpResponse<any>) => {
            if(response.status == 204){
                console.log("No results in the API call.");
                //return throwError({ status: 204, message: "No response returned. This query is valid but has no results."});
                throw { status: 204, message: "No response returned. This query is valid but has no results."};
            } else {
                console.log("Response.body: ", response.body);
                return this.processResponse(response.body, start!, end!)
            }
        }),
        catchError(this.handleError)
    );

   }

   /**
    * Currently just translates data table returned directly from the Trade API into
    * a JSON object for display in the angular data table. 
    * The goal is to reduce processing as much as possible to most accurately reflect the 
    * API's results.
    * @param data the actual data
    * @param start start date in the form YEAR-MO
    * @param end  end date in the form YEAR-MO 
    * @returns 
    */
   processResponse(data: any, start: string, end: string): any {
    let resp = this.jsonifiedDataTable(data);
    console.log("Reaching resp after jsonification: ", resp);

    resp = resp.map(row => {
        const processedRow = { ... row};
        Object.keys(processedRow).forEach(key => {
            /*if(processedRow[key] == '-'){
                processedRow[key] = "null"
            }*/
        });
        return processedRow;

    }).filter(row => { //filtering out rows that are in dates that don't count
        return this.inDateRange(row, start!, end!);
    });

    console.log("Finishing processResponse!", resp);

    return resp;
   }

   /**
    * Checks if a given date is between start and end. Used because the API
    * will return all months in all years for a given query, when YEAR/MO time
    * format is used.
    * @param row an entry in the table returned by the Trade API
    * @param start YEAR-MO start
    * @param end YEAR-MO end
    * @returns 
    */
   inDateRange(row: any[], start: string, end: string): boolean {

        const [startYear, startMonth] = start.split('-').map(Number);
        const [endYear, endMonth] = end.split('-').map(Number);

        const yr = ((row as { [key: string]:any})['YEAR'] as number);
        const mo = ((row as { [key: string]:any})['MONTH'] as number);

        if((yr == startYear && (mo < startMonth)) || 
            (yr == endYear && (mo > endMonth))
        ){
            console.log("Returning false for year and month: ", yr, mo);
            return false;
        }

        return true;

   }

   /***
   * converting the data array returned from the trade API into a JSON-like
   * object for formatting as a mat-table
   * 
   * @param data: any[] containing the raw result returned by the API via the 
   * dataService. This is in the form ["col1"...], [row1], [row2]...
   * @returns the data as a dictionary in the form ["col1": data1, "col2: " data2, ...]
   */
  jsonifiedDataTable(data: any[]): any[] {
    const [header, ...rows] = data;
    const formattedData = rows.map(row => {
      const rowData: any = {};
      header.forEach((col: string, index: number) => {
        //excluding rows disabled for paired params
        const name = Object.keys(this.paired_params).find(key =>
            this.paired_params[key] === col);
        console.log("Name for col: ", name, col);
        rowData[col] = row[index];
      });
      return rowData;
    });
    return formattedData;
  }

   
   /**
    * Takes in a start and end (4-dig year, 2-dig month) and returns the API strin
    * to collect all months from start to end (inclusive). For example, "YEAR=2020&MONTH=01&MONTH=02"
    * @param start 
    * @param end 
    * @returns string to append to the full API call
    */
   getTimeString(start: string, end: string, time: boolean): string {

        const [startYear, startMonth] = start.split('-').map(Number);
        const [endYear, endMonth] = end.split('-').map(Number);

        let fullString = "";
        
        //We're querying with the "time" parameter, not year/month
        if(time){
            if(start == end){
                fullString = "&time=" + start;
            } else {
                fullString = "&time=from+" + start + "+to+" + end;
            }
            
        } else { //we're querying with YEAR/MONTH
            let year = startYear;
            let month = startMonth;
            let toAdd = "";
            fullString = `&YEAR=${startYear}`;
    
            while (year < endYear || (year == endYear && month <= endMonth)){
                toAdd = `&MONTH=${String(month).padStart(2, '0')}`;
                //this month is not already present
                if(fullString.indexOf(toAdd) == -1){
                    fullString += toAdd;
                }
                month++;
                if (month > 12){
                    month = 1;
                    year++;
                    if (year <= endYear ){
                        fullString += `&YEAR=${String(year)}`
                    }   
                }
            }
        }

        return fullString;
   }

/*
Handles special chars in names, inc. spaces, parens, "+", "&", etc.
Commas, parens, periods, dashes, are fine to be left as-is
*/
handleSpecialChars(str: string): string {
    //let newString: string = "";
    return str.replaceAll("+", "%2B").replaceAll(" ", "+").replaceAll("&", "%26").replaceAll("/", "%2F").replaceAll("\\", "%5C").replaceAll(",", "%2C");
}

/**
* Processes the given parameters into an API string
* @param formValues Initial params (exports, dataset, start/end)
* @param selectedItems Parameters selected from the dropdown
* In the format ["category,description": [[code, optional description], ...], ....]
* @returns a fully-formatted string representing the current API call
*/
formatApiCall(formValues: any, selectedItems: { [key: string]: string[] }): any {
    const apiUrl = "https://api.census.gov/data/timeseries/intltrade";
    
    let exp = formValues.exports ? formValues.exports : "";
    const db = formValues.database ? formValues.database : "";
    const start = formValues.start ? formValues.start : "";
    const end = formValues.end ? formValues.end : "";
    let time = formValues.time ? formValues.time : "";
    time = time == "time" ? true : false;

    //values selected for certain params (added in the form XX=XY&YY=Z....)
    let paramString = "";
    //parameters selected to include in the data table (added to get=XYZ...)
    let getString = "";
    const param_list = selectedItems;
    let opts = [];
    let curParam = "";

    for (const param in param_list) {
        opts = param_list[param] 
        //console.log("opts", opts);
        curParam = param.split(',')[0]
        if(opts.length == 0){
            getString += this.handleSpecialChars(curParam) + ","; 
        }

        for (const opt in opts) {
            if(Array.isArray(opts[opt])){
                if(Object.values(this.paired_params).includes(curParam)){ //this parameter is a pairedParam value, so we take the second item
                    paramString += this.handleSpecialChars(curParam) + "=" + this.handleSpecialChars(opts[opt][1]) + "&";
                } else {
                    paramString += this.handleSpecialChars(curParam) + "=" + this.handleSpecialChars(opts[opt][0]) + "&";
                }
            } else {
                paramString += this.handleSpecialChars(curParam) + "=" + this.handleSpecialChars(opts[opt]) + "&";
            }
        }
    }

    let fullUrl = apiUrl + "/" + exp + "/" + db
    if (getString != "") {
    getString = getString.slice(0, -1);
    fullUrl += "?get=" + getString;
    }

    if (start != "" && end != ""){
        fullUrl += this.getTimeString(start, end, time);
    }

    if (paramString != "") {
    paramString = paramString.slice(0, -1);
    fullUrl += "&" + paramString;
    }

    return fullUrl;
    
  }

  getPairedParams(): {[key: string]: string} {
    return this.paired_params;
  }

  /**
   * Handles the general export process for CSV, JSON, and Excel
   * @param dataSource the dataSource object storing the data table returned by the trade API
   * @param displayedColumns Column header titles
   */
   exportTableCSV(dataSource: MatTableDataSource<any>, displayedColumns: string[]) { 
    //console.log("reached export CSV case IN service");
        const csvData = this.convertToCSV(dataSource.data, displayedColumns); 
        const blob = new Blob([csvData], { type: 'text/csv' }); 
        const url = window.URL.createObjectURL(blob); 
        const a = document.createElement('a'); 
        a.setAttribute('href', url); 
        a.setAttribute('download', 'data.csv'); 
        a.click(); 
    } 
    
    /**
     * Helper function for export process to convert a dataSource object to csv data
     * @param data data table
     * @param columns column names
     * @returns 
     */
    private convertToCSV(data: any[], columns: string[]): string { 
        const header = columns.join(','); 
        const rows = data.map(row => columns.map(column => JSON.stringify(row[column], replacer)).join(',') ); 
        return [header, ...rows].join('\r\n'); 
        function replacer(key: string, value: any) { return value === null ? '' : value; } 
    }

    exportTableExcel(dataSource: MatTableDataSource<any>){
        const data = dataSource.data;
        const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
        const workbook: XLSX.WorkBook = { Sheets: {'data': worksheet }, SheetNames: ['data']};
        const excelBuffer: any = XLSX.write(workbook, {bookType: 'xlsx', type: 'array'});
        this.saveAsExcelFile(excelBuffer, 'data');
    }

    private saveAsExcelFile(buffer: any, fileName: string): void { 
        const EXCEL_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8';
        const data: Blob = new Blob([buffer], { type: EXCEL_TYPE }); 
        const url = window.URL.createObjectURL(data); 
        const link = document.createElement('a'); 
        link.href = url; 
        link.download = fileName + '.xlsx'; 
        link.click(); 
        window.URL.revokeObjectURL(url); 
    } 

    exportTableJson(dataSource:  MatTableDataSource<any>): void {
        const data = dataSource.data;
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'data.json';
        link.click();
        window.URL.revokeObjectURL(url);
    }
 
}