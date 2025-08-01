interface Resume {
    id: string;
    companyName?: string;
    jobTitle?: string;
    imagePath: string;
    resumePath: string;
    feedback: Feedback;
}

interface Feedback {
    overall_rating: number;
    rating_scale: string;
    ats_compatibility: number;
    ats_issues: string[];
    strengths: string[];
    weaknesses: string[];
    red_flags: string[];
    specific_improvements: string[];
    recommendations: string[];
    keyword_optimization: string[];
    content_analysis: {
        contact_information: number;
        professional_summary: number;
        work_experience: number;
        education: number;
        skills: number;
        [key: string]: number;
    };
}