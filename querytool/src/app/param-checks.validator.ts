import { AbstractControl, ValidatorFn } from '@angular/forms';

export function endAfterStart(): ValidatorFn {
 return (control: AbstractControl): { [key: string]: any} | null => {
    
    const start = control.get('start')?.value;
    const end = control.get('end')?.value;

    //console.log("Start and end: ", start, end);
    
    if (start && end){
        const startDate = new Date(start);
        const endDate = new Date(end);
        //console.log("Start and end DATE: ", startDate, endDate);
        return endDate >= startDate ? null : { endAfterStart: true};
    }
    return null;
 };
};

export function startBeforePresent(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any} | null => {
    
        const start = control.get('start')?.value;
        
        if (start){
            const startDate = new Date(start)
            const currentDate = new Date();
            //console.log("start in startBeforePResent: ", start);
            return startDate <= currentDate ? null : { startBeforePresent: true};
        }
        return null;
     };
}