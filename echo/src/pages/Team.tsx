/**
 * 团队管理页面
 */

import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
  UserPlus, Users, Briefcase, Target, Calendar,
  Check, Mail, Phone,
} from 'lucide-react';

// 团队成员类型
interface TeamMember {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  joinDate: string;
  skills: string[];
  notes?: string;
}

// 团队目标
interface TeamGoal {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignees: string[];
  createdAt: string;
}

// 本地存储 key
const TEAM_MEMBERS_KEY = 'echo_team_members';
const TEAM_GOALS_KEY = 'echo_team_goals';

// 获取团队成员
function getTeamMembers(): TeamMember[] {
  const data = localStorage.getItem(TEAM_MEMBERS_KEY);
  return data ? JSON.parse(data) : [];
}

// 保存团队成员
function saveTeamMembers(members: TeamMember[]) {
  localStorage.setItem(TEAM_MEMBERS_KEY, JSON.stringify(members));
}

// 获取团队目标
function getTeamGoals(): TeamGoal[] {
  const data = localStorage.getItem(TEAM_GOALS_KEY);
  return data ? JSON.parse(data) : [];
}

// 保存团队目标
function saveTeamGoals(goals: TeamGoal[]) {
  localStorage.setItem(TEAM_GOALS_KEY, JSON.stringify(goals));
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [goals, setGoals] = useState<TeamGoal[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  // 新成员表单
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newSkills, setNewSkills] = useState('');

  // 新目标表单
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');

  // 加载数据
  useEffect(() => {
    setMembers(getTeamMembers());
    setGoals(getTeamGoals());
  }, []);

  // 添加成员
  const handleAddMember = () => {
    if (!newName || !newRole) return;
    const member: TeamMember = {
      id: Date.now().toString(),
      name: newName,
      role: newRole,
      email: newEmail || undefined,
      phone: newPhone || undefined,
      joinDate: new Date().toISOString().split('T')[0],
      skills: newSkills ? newSkills.split(',').map(s => s.trim()) : [],
    };
    const updated = [...members, member];
    saveTeamMembers(updated);
    setMembers(updated);
    setNewName('');
    setNewRole('');
    setNewEmail('');
    setNewPhone('');
    setNewSkills('');
    setShowAddMember(false);
  };

  // 添加目标
  const handleAddGoal = () => {
    if (!goalTitle) return;
    const goal: TeamGoal = {
      id: Date.now().toString(),
      title: goalTitle,
      description: goalDesc || undefined,
      deadline: goalDeadline || undefined,
      status: 'pending',
      assignees: [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    const updated = [...goals, goal];
    saveTeamGoals(updated);
    setGoals(updated);
    setGoalTitle('');
    setGoalDesc('');
    setGoalDeadline('');
    setShowAddGoal(false);
  };

  // 更新目标状态
  const handleUpdateGoalStatus = (id: string, status: TeamGoal['status']) => {
    const updated = goals.map(g => g.id === id ? { ...g, status } : g);
    saveTeamGoals(updated);
    setGoals(updated);
  };

  // 删除成员
  const handleDeleteMember = (id: string) => {
    const updated = members.filter(m => m.id !== id);
    saveTeamMembers(updated);
    setMembers(updated);
    if (selectedMember === id) setSelectedMember(null);
  };

  const selectedMemberData = members.find(m => m.id === selectedMember);

  return (
    <div className="p-4 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">团队管理</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAddGoal(true)}>
            <Target className="h-4 w-4 mr-1" />
            添加目标
          </Button>
          <Button size="sm" onClick={() => setShowAddMember(true)}>
            <UserPlus className="h-4 w-4 mr-1" />
            添加成员
          </Button>
        </div>
      </div>

      {/* 添加成员表单 */}
      {showAddMember && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">添加团队成员</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="姓名 *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                placeholder="职位 *"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="邮箱"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Input
                placeholder="电话"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <Input
              placeholder="技能标签（逗号分隔）"
              value={newSkills}
              onChange={(e) => setNewSkills(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleAddMember} disabled={!newName || !newRole}>
                添加
              </Button>
              <Button variant="outline" onClick={() => setShowAddMember(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 添加目标表单 */}
      {showAddGoal && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">添加团队目标</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="目标标题 *"
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
            />
            <Textarea
              placeholder="目标描述..."
              value={goalDesc}
              onChange={(e) => setGoalDesc(e.target.value)}
              rows={2}
            />
            <Input
              type="date"
              placeholder="截止日期"
              value={goalDeadline}
              onChange={(e) => setGoalDeadline(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleAddGoal} disabled={!goalTitle}>
                添加
              </Button>
              <Button variant="outline" onClick={() => setShowAddGoal(false)}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 团队目标 */}
      {goals.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              团队目标
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  className="flex items-center justify-between p-2 rounded-lg border"
                >
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${goal.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                      {goal.title}
                    </p>
                    {goal.deadline && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {goal.deadline}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {goal.status !== 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUpdateGoalStatus(goal.id, 'completed')}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 团队成员列表 */}
      {members.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">团队成员 ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedMember === member.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-accent border border-transparent'
                  }`}
                  onClick={() => setSelectedMember(
                    selectedMember === member.id ? null : member.id
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {member.name[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 成员详情 */}
      {selectedMemberData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">成员详情</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-medium text-primary">
                  {selectedMemberData.name[0]}
                </span>
              </div>
              <div>
                <p className="font-medium">{selectedMemberData.name}</p>
                <p className="text-sm text-muted-foreground">{selectedMemberData.role}</p>
              </div>
            </div>
            
            {selectedMemberData.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{selectedMemberData.email}</span>
              </div>
            )}
            
            {selectedMemberData.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{selectedMemberData.phone}</span>
              </div>
            )}
            
            {selectedMemberData.skills.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedMemberData.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs bg-accent rounded-full"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              加入时间: {selectedMemberData.joinDate}
            </p>
            
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDeleteMember(selectedMemberData.id)}
            >
              移除成员
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 空状态 */}
      {members.length === 0 && goals.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              添加团队成员和目标，开始协作管理
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
