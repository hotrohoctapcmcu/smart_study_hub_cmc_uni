import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NotebookToolbar from '../pages/Textbook/NotebookToolbar';

beforeEach(()=>localStorage.clear());
describe('Notebook grouped toolbar',()=>{
  it('marks only the actual pen variant active when parent tool options are provided',()=>{
    render(<NotebookToolbar tool="pen" toolOptions={{penType:'ballpoint'}}/>);fireEvent.click(screen.getByRole('button',{name:'Viết',exact:true}));
    expect(screen.getByRole('menuitem',{name:/Bút bi/}).classList.contains('active')).toBe(true);
    for(const name of ['Bút máy','Bút cọ','Bút thư pháp'])expect(screen.getByRole('menuitem',{name}).classList.contains('active')).toBe(false);
  });
  it('dispatches a writing variant and inserts a ruler without changing the active pen',()=>{
    const onTool=vi.fn(),onInsert=vi.fn();
    render(<NotebookToolbar tool="pen" onTool={onTool} onInsert={onInsert}/>);
    fireEvent.click(screen.getByRole('button',{name:'Viết',exact:true}));
    fireEvent.click(screen.getByRole('menuitem',{name:'Bút máy'}));
    expect(onTool).toHaveBeenCalledWith('pen',{penType:'fountain'});
    fireEvent.click(screen.getByRole('button',{name:'Dụng cụ',exact:true}));
    fireEvent.click(screen.getByRole('menuitem',{name:'Thước kẻ'}));
    expect(onInsert).toHaveBeenCalledWith('ruler',{});
    expect(onTool).toHaveBeenCalledTimes(1);
  });
  it('keeps user pins, filters tools, and remembers recent actions',()=>{
    const onInsert=vi.fn();
    render(<NotebookToolbar tool="select" onInsert={onInsert}/>);
    fireEvent.click(screen.getByRole('button',{name:'Chèn',exact:true}));
    fireEvent.change(screen.getByLabelText('Tìm công cụ'),{target:{value:'Khối mã'}});
    expect(screen.queryByRole('menuitem',{name:'Bảng'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Ghim Khối mã'}));
    fireEvent.click(screen.getByRole('menuitem',{name:'Khối mã'}));
    expect(onInsert).toHaveBeenCalledWith('code',{});
    expect(JSON.parse(localStorage.getItem('ssh-notebook-toolbar')).pins).toContain('code');
    fireEvent.click(screen.getByRole('button',{name:'Công cụ vừa dùng'}));
    expect(screen.getByRole('menuitem',{name:'Khối mã'})).toBeTruthy();
    fireEvent.keyDown(document,{key:'Escape'});
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button',{name:'Công cụ vừa dùng'}));
  });
  it('routes AI actions and exposes real undo availability',()=>{
    const onAI=vi.fn(),onUndo=vi.fn();
    render(<NotebookToolbar tool="text" onAI={onAI} onUndo={onUndo} canUndo canRedo={false}/>);
    fireEvent.click(screen.getByRole('button',{name:'Hoàn tác · Ctrl Z'}));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.getByRole('button',{name:'Làm lại · Ctrl Shift Z'}).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Trợ lý AI',exact:true}));
    fireEvent.click(screen.getByRole('menuitem',{name:'Viết tay thành chữ'}));
    expect(onAI).toHaveBeenCalledWith('Viết tay thành chữ');
  });
});
