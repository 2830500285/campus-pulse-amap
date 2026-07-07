import type { PlaceCategory } from '../types/navigation'

export const placeCategories: PlaceCategory[] = [
  { id: 'teaching', label: '教学楼', icon: '教', order: 1, accent: '#ff7a3d' },
  { id: 'lab', label: '实验楼', icon: '研', order: 2, accent: '#0f6c5a' },
  { id: 'dormitory', label: '宿舍', icon: '宿', order: 3, accent: '#5b4ae6' },
  { id: 'dining', label: '食堂', icon: '食', order: 4, accent: '#c93b2e' },
  { id: 'library', label: '图书馆', icon: '馆', order: 5, accent: '#1b4bc2' },
  { id: 'sports', label: '体育场馆', icon: '体', order: 6, accent: '#067c6a' },
  { id: 'admin', label: '行政办事', icon: '办', order: 7, accent: '#7a4b18' },
  { id: 'gate', label: '校门/交通', icon: '门', order: 8, accent: '#1d2939' },
  { id: 'medical', label: '医疗服务', icon: '医', order: 9, accent: '#9f1d35' },
  { id: 'landmark', label: '景观/广场', icon: '景', order: 10, accent: '#1879b8' },
]
