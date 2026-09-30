import {Module} from '@nestjs/common';
import {GuidanceModule} from '../guidance/guidance.module';
import {DocumentsService} from './documents.service';
@Module({imports:[GuidanceModule],providers:[DocumentsService],exports:[DocumentsService]})
export class DocumentsModule{}
