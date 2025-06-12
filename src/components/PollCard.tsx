import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Poll } from '@/contexts/Web3Context';
import { Clock, Users, Vote } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PollCardProps {
  poll: Poll;
}

const PollCard: React.FC<PollCardProps> = ({ poll }) => {
  const isEnded = Date.now() / 1000 > poll.endTime;
  const endDate = new Date(poll.endTime * 1000);
  const participationRate = (poll.voterCount / poll.maxVoters) * 100;

  return (
    <Card className="card-hover shadow-card">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-2">
            {poll.title}
          </CardTitle>
          <div className="flex space-x-2">
            {poll.isPrivate && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                Private
              </Badge>
            )}
            <Badge variant={isEnded ? "destructive" : "default"}>
              {isEnded ? 'Ended' : 'Active'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4" />
            <span>{poll.voterCount}/{poll.maxVoters}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Vote className="w-4 h-4" />
            <span>{poll.candidateCount} candidates</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span>{isEnded ? 'Ended' : 'Ends'} {endDate.toLocaleDateString()}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Participation</span>
            <span>{participationRate.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(participationRate, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Link to={`/poll/${poll.id}${poll.isPrivate ? '?type=private' : ''}`} className="w-full">
          <Button className="w-full btn-gradient">
            {isEnded ? 'View Results' : 'Vote Now'}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default PollCard;
