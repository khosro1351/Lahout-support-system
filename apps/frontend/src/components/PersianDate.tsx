import {formatPersianDate} from '../utils/persianDate';

// Isolate the numeric run so surrounding RTL text cannot reorder date and time.
export function PersianDate({value,withTime=false}:{value:unknown;withTime?:boolean}){
 return <span dir="rtl"><bdi dir="ltr">{formatPersianDate(value,withTime)}</bdi></span>;
}
