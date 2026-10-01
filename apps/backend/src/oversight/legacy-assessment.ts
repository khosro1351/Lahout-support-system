import {Pool,PoolClient} from 'pg';
import {AppError} from '../common/app-error';
export async function hasComprehensive(db:Pool|PoolClient,familyId:string){
 return !!(await db.query("SELECT 1 FROM assessment.drafts d JOIN assessment.models m ON m.id=d.model_id WHERE d.family_id=$1 AND m.version='2.0' LIMIT 1",[familyId])).rowCount;
}
export async function assertLegacyWritable(db:Pool|PoolClient,familyId:string){
 if(await hasComprehensive(db,familyId))throw new AppError(409,'COMPREHENSIVE_REQUIRED','این خانواده وارد ارزیابی جامع شده است؛ نسخه قبلی فقط مرجع تاریخی است.');
}
