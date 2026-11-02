import React, {useState} from 'react';
import {describe,it,expect} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import NotebookTableFields,{changeTableAxis,pasteTableData} from '../pages/Textbook/NotebookTableFields';
import {tableCellSpans} from '../utils/textbookCanvas';
const initial={rows:2,cols:2,cells:[['A','B'],['C','D']],columnWidths:[1,2],rowHeights:[2,1]};
function Harness(){const [form,setForm]=useState(initial);return <><NotebookTableFields form={form} setForm={setForm}/><output data-testid="data">{JSON.stringify(form)}</output></>;}
describe('Notebook table fields',()=>{
  it('inserts and deletes rows/columns while preserving existing data, weights and merges',()=>{
    const merged={...initial,merges:[{row:0,col:0,rowSpan:2,colSpan:2}]};
    const added=changeTableAxis(merged,'row',1);
    expect(added.cells).toEqual([['A','B'],['',''],['C','D']]);expect(added.rowHeights).toEqual([2,1,1]);
    expect(added.merges[0].rowSpan).toBe(3);
    expect(changeTableAxis(added,'row',1,true).cells).toEqual(initial.cells);
    const deleted=changeTableAxis(initial,'col',0,true);expect(deleted.cells).toEqual([['B'],['D']]);expect(deleted.columnWidths).toEqual([2]);
  });
  it('pastes TSV across a merged region, expands dimensions and keeps unaffected data',()=>{
    const next=pasteTableData({...initial,merges:[{row:0,col:0,rowSpan:1,colSpan:2}]},'Xin\tchào\nViệt\tNam',0,1);
    expect(next.cols).toBe(3);expect(next.cells).toEqual([['A','Xin','chào'],['C','Việt','Nam']]);
    expect(tableCellSpans(next,0,1)).toEqual({rowSpan:1,colSpan:1});
  });
  it('edits cells, pastes Excel data, shifts selection and updates column/row ratios',()=>{
    render(<Harness/>);
    fireEvent.change(screen.getByLabelText('Hàng 1 cột 1'),{target:{value:'Nội dung'}});
    fireEvent.paste(screen.getByLabelText('Hàng 2 cột 1'),{clipboardData:{getData:()=> 'Môn học\tĐiểm\nToán\t9'}});
    expect(screen.getByLabelText('Hàng 3 cột 2').value).toBe('9');
    fireEvent.change(screen.getByLabelText('Tỷ lệ cột 1'),{target:{value:'3'}});
    fireEvent.change(screen.getByLabelText('Điều chỉnh tỷ lệ hàng 2'),{target:{value:'2.5'}});
    let data=JSON.parse(screen.getByTestId('data').textContent);expect(data.columnWidths[0]).toBe(3);expect(data.rowHeights[1]).toBe(2.5);
    fireEvent.click(screen.getByLabelText('Hàng 1 cột 1'));
    fireEvent.click(screen.getByLabelText('Hàng 1 cột 2'),{shiftKey:true});
    fireEvent.click(screen.getByText('Gộp vùng chọn'));
    expect(screen.queryByLabelText('Hàng 1 cột 2')).toBeNull();
    fireEvent.click(screen.getByText('Tách ô vùng chọn'));
    expect(screen.getByLabelText('Hàng 1 cột 2').value).toBe('B');
    fireEvent.click(screen.getByText('Thêm cột sau ô chọn'));
    expect(JSON.parse(screen.getByTestId('data').textContent).cols).toBe(3);
  });
});
