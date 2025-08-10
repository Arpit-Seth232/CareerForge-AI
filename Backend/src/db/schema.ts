import { users } from "./users";
import { roadmaps } from "./roadmaps";
import {
  recommendationHistory,
  recommendationTypeEnum,
} from "./recommendationHistory";
import { aiChatHistory, senderTypeEnum } from "./aiChatHistory";
import { analytics } from "./analytics";
import { mentorMatches } from "./mentorMatches";
import { mentors } from "./mentors";
import { resumes, resumeSourceEnum } from "./resumes";
import { jobMatches } from "./jobMatches";

export const schema = {
  aiChatHistory,
  users,
  roadmaps,
  recommendationHistory,
  recommendationTypeEnum,
  senderTypeEnum,
  analytics,
  mentorMatches,
  mentors,
  resumeSourceEnum,
  resumes,
  jobMatches,
};
