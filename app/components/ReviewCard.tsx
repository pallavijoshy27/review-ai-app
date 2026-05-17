type ReviewCardProps = {
    review: string;
    response: string;
  };
  
  export default function ReviewCard({
    review,
    response,
  }: ReviewCardProps) {
    return (
      <div className="bg-zinc-900 p-6 rounded-2xl mb-6">
        <h2 className="text-2xl font-semibold">
          New Review
        </h2>
  
        <p className="text-zinc-400 mt-2">
          {review}
        </p>
  
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">
            AI Suggested Reply:
          </h3>
  
          <p className="bg-zinc-800 p-4 rounded-xl">
            {response}
          </p>
        </div>
  
        <button className="mt-6 bg-white text-black px-6 py-3 rounded-xl font-medium">
          Post Reply
        </button>
      </div>
    );
  }