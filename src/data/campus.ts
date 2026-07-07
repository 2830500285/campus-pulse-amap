import type { CampusConfig } from '../types/navigation'

export const campusConfig: CampusConfig = {
  id: 'campus-pulse-qingdao',
  name: '山科智行 Campus Pulse',
  city: '青岛西海岸新区',
  description:
    '把青岛校区高频地点、步行路径和服务场景整理成一张可交互的校园行动看板，适合新生报到、日常通勤和访客引导。',
  mapAsset: 'maps/campus-pulse-topology.svg',
  mapAlt: '山科智行校园拓扑底图',
  mapNote:
    '当前底图采用轻量拓扑表达，重点突出步行关系。后续替换正式平面图时只需保持点位百分比坐标同步校准。',
  defaultView: {
    centerLabel: '行动中枢',
    highlightedZones: ['学习核心带', '实验创新带', '生活补给带', '访客入口带'],
  },
}

export const campusZones = [
  {
    name: '学习核心带',
    summary: '覆盖图书信息中心、逸夫楼、行政楼和主要教学节点，适合查课、自习、办事和集合。',
  },
  {
    name: '实验创新带',
    summary: '围绕工程实训中心、地学楼和北侧科研空间，服务实验课、竞赛训练和创新项目。',
  },
  {
    name: '生活补给带',
    summary: '串联宿舍、公寓、餐厅、校医院和东门，面向返宿、就餐、取药和夜间回程。',
  },
  {
    name: '访客入口带',
    summary: '连接西门、交流中心、体育场和大型活动集结点，适合访客入校与活动签到。',
  },
] as const
