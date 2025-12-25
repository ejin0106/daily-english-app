import AV from 'leancloud-storage';
import { DailyLesson } from '../types';

AV.init({
  appId: "e8NW7q7LbOgTb8mT4tT9VPSb-gzGzoHsz",
  appKey: "wWJPSjQHnSc9NZYMHwhFLbgG",
  serverURL: "https://e8nw7q7l.lc-cn-n1-shared.com"
});

export class DBService {
  
  // Helper to convert LeanCloud object to our DailyLesson interface
  private mapToLesson(avObj: AV.Object): DailyLesson {
    const attrs = avObj.attributes;
    // Handle createdAt: check for custom 'timestamp' field, fall back to system createdAt
    // avObj.createdAt is a Date object provided by LeanCloud
    const systemCreatedAt = avObj.createdAt ? avObj.createdAt.getTime() : Date.now();
    
    return {
      id: attrs.localId, // We use the localId (UUID) for routing consistency
      _objectId: avObj.id,
      date: attrs.date,
      vocabularyTitle: attrs.vocabularyTitle,
      vocabulary: attrs.vocabulary || [],
      story: attrs.story || { title: 'Untitled', content: '' },
      createdAt: attrs.timestamp || systemCreatedAt,
      order: attrs.order,
      audioUrl: attrs.audioUrl
    } as DailyLesson;
  }

  async saveLesson(lesson: DailyLesson): Promise<void> {
    try {
      // 1. Handle Audio Upload if necessary
      let audioUrl = lesson.audioUrl;
      
      // If there is a new blob/file, upload it
      if (lesson.audioBlob && (lesson.audioBlob instanceof File || lesson.audioBlob instanceof Blob)) {
         const name = (lesson.audioBlob as File).name || `audio-${Date.now()}.mp3`;
         const file = new AV.File(name, lesson.audioBlob);
         const savedFile = await file.save();
         audioUrl = savedFile.url();
      }

      // 2. Check if we are updating an existing object
      let obj: AV.Object;
      
      // Try to find by _objectId first if we have it
      if (lesson._objectId) {
         obj = await AV.Object.createWithoutData('Lesson', lesson._objectId).fetch();
      } else {
         // Fallback: try to find by localId (the UUID)
         const query = new AV.Query('Lesson');
         query.equalTo('localId', lesson.id);
         try {
            const existing = await query.first();
            obj = existing || new AV.Object('Lesson');
         } catch (e: any) {
            // If class doesn't exist, create new object
            if (e.code === 101 || (e.response && e.response.status === 404)) {
               obj = new AV.Object('Lesson');
            } else {
               throw e;
            }
         }
      }

      // 3. Set fields
      obj.set('localId', lesson.id);
      obj.set('date', lesson.date);
      obj.set('vocabularyTitle', lesson.vocabularyTitle);
      obj.set('vocabulary', lesson.vocabulary);
      obj.set('story', lesson.story);
      
      // FIX: 'createdAt' is a reserved system field in LeanCloud.
      // We use 'timestamp' to store the client-side creation time.
      if (obj.isNew()) {
         obj.set('timestamp', lesson.createdAt);
      }
      
      if (lesson.order !== undefined) obj.set('order', lesson.order);
      if (audioUrl) obj.set('audioUrl', audioUrl);

      await obj.save();
    } catch (error) {
      console.error("LeanCloud Save Error", error);
      throw error;
    }
  }

  async saveLessonsOrder(lessons: DailyLesson[]): Promise<void> {
    try {
      // Create a list of objects to update
      const objectsToUpdate: AV.Object[] = [];
      
      for (const lesson of lessons) {
        if (lesson._objectId) {
           const obj = AV.Object.createWithoutData('Lesson', lesson._objectId);
           obj.set('order', lesson.order);
           objectsToUpdate.push(obj);
        }
      }
      
      if (objectsToUpdate.length > 0) {
        await AV.Object.saveAll(objectsToUpdate);
      }
    } catch (error) {
       console.error("LeanCloud Order Save Error", error);
       throw error;
    }
  }

  async getAllLessons(): Promise<DailyLesson[]> {
    try {
      const query = new AV.Query('Lesson');
      query.limit(1000);
      // Sort by order ascending, then by system createdAt descending
      query.ascending('order');
      query.addDescending('createdAt'); 
      
      const results = await query.find();
      return results.map(r => this.mapToLesson(r));
    } catch (error: any) {
      // Code 101: Class not found (Fresh app state)
      if (error.code === 101 || (error.response && error.response.status === 404)) {
        console.log("Database empty or initialized. No lessons found.");
        return [];
      }
      console.error("LeanCloud Fetch Error", error);
      return [];
    }
  }

  async getLessonById(id: string): Promise<DailyLesson | undefined> {
    try {
      const query = new AV.Query('Lesson');
      query.equalTo('localId', id);
      const result = await query.first();
      return result ? this.mapToLesson(result) : undefined;
    } catch (error: any) {
      // Code 101: Class not found
      if (error.code === 101 || (error.response && error.response.status === 404)) {
        return undefined;
      }
      console.error("LeanCloud GetById Error", error);
      return undefined;
    }
  }

  async deleteLesson(id: string): Promise<void> {
    try {
      const query = new AV.Query('Lesson');
      query.equalTo('localId', id);
      const result = await query.first();
      if (result) {
        await result.destroy();
      }
    } catch (error) {
      console.error("LeanCloud Delete Error", error);
      throw error;
    }
  }
}

export const dbService = new DBService();