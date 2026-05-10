import React, { useState } from 'react';
import { api } from '../api';
import SmartTagInput from './SmartTagInput';

interface Tag {
  tag: string;
  weight: number;
}

interface TagManagerProps {
  description: string;
  tags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
}

const TagManager: React.FC<TagManagerProps> = ({ description, tags, onTagsChange }) => {
  const [loading, setLoading] = useState(false);

  const handleGenerateTags = async () => {
    if (!description.trim()) return;
    setLoading(true);
    try {
      const res = await api.generateTags(description);
      
      // Safety check: ensure res.tags is an array
      const suggestions = Array.isArray(res?.tags) ? res.tags : [];
      
      // Merge suggestions avoiding duplicates based on tag string
      const uniqueNewTags = suggestions.filter((newTag: Tag) => !tags.some(existing => existing.tag === newTag.tag));
      onTagsChange([...tags, ...uniqueNewTags]);
    } catch (e) {
      console.error(e);
      alert("Failed to generate tags");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/20">
      <div className="flex justify-between items-center mb-3">
        <label className="text-sm font-bold flex items-center gap-2">
          <i className="fas fa-tags text-primary"></i> Smart Tags
        </label>
        <button
          type="button"
          onClick={handleGenerateTags}
          disabled={loading || !description.trim()}
          className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-full font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1"
        >
          {loading ? <><i className="fas fa-circle-notch fa-spin"></i> Analyzing...</> : <><i className="fas fa-magic"></i> Generate Tags</>}
        </button>
      </div>

      <div className="space-y-3">
        {/* Replaced manual input with SmartTagInput */}
        <SmartTagInput 
            value={tags} 
            onChange={onTagsChange} 
            placeholder="Search existing tags or create new ones..."
        />
        
        {/* Footer Info */}
        {tags.length > 0 ? (
             <div className="flex justify-between items-center text-[10px] px-1 pt-1">
                <span className={`${tags.length < 5 ? 'text-orange-500' : 'text-green-600'} font-bold`}>
                    {tags.length} tags selected
                </span>
                <span className="text-muted-foreground italic">
                    Verify tags before posting. Remove irrelevant ones.
                </span>
            </div>
        ) : (
            <p className="text-[10px] text-muted-foreground italic px-1">
                AI-generated tags help your product appear in recommendations.
            </p>
        )}
      </div>
    </div>
  );
};

export default TagManager;