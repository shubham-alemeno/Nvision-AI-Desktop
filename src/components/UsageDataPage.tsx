import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/services/api';
import { getInferenceUsage, getGroupInferenceUsage } from '@/services/api';

interface InferenceUsage {
  id: number;
  username: string;
  user_email: string;
  user_groups: string[];
  inference_count: number;
  created_at: string;
  updated_at: string;
  last_inference_at: string;
}

interface GroupUsage {
  group_name: string;
  user_count: number;
  total_inferences: number;
  average_inferences: number;
}

const UsageDataPage = () => {
  const [inferenceUsage, setInferenceUsage] = useState<InferenceUsage | null>(
    null
  );
  const [groupUsage, setGroupUsage] = useState<GroupUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsageData = async () => {
      try {
        const [userUsage, groupData] = await Promise.all([
          getInferenceUsage(),
          getGroupInferenceUsage(),
        ]);
        setInferenceUsage(userUsage);
        setGroupUsage(groupData);
      } catch (error) {
        console.error('Error fetching usage data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsageData();
  }, []);

  if (loading) {
    return (
      // <div className="flex flex-col gap-4 p-4">
      //   <Skeleton className="h-12 w-1/2" />
      //   <div className="grid grid-cols-2 gap-4">
      //     <Skeleton className="h-20 w-full" />
      //     <Skeleton className="h-20 w-full" />
      //   </div>
      // </div>
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Defect Checker Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Account usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {inferenceUsage?.inference_count || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {groupUsage[0]?.total_inferences || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Inference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">{inferenceUsage?.last_inference_at ? new Date(inferenceUsage.last_inference_at).toLocaleString() : 'Never'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Group Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <p>Group: {groupUsage[0]?.group_name || 'N/A'}</p>
              <p>Members: {groupUsage[0]?.user_count || 0}</p>
              <p>Avg Inferences: {groupUsage[0]?.average_inferences || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div> */}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsageDataPage;
