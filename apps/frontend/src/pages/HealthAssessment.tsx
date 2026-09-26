import {useParams} from 'react-router-dom';
import {Screen,useData} from './GuideWorkspace';
import {AssessmentDomainTabs} from '../components/AssessmentDomainTabs';

export function HealthAssessment(){
 const {id}=useParams();
 const {data,error}=useData('/livelihood/families/'+id);
 return <Screen title="سلامت و درمان" error={error} loading={!data&&!error}>{data&&<>
  <AssessmentDomainTabs familyId={id!}/>
  <p dir="rtl">ارزیابی سلامت و درمان این خانواده هنوز تکمیل نشده است.</p>
 </>}</Screen>;
}
