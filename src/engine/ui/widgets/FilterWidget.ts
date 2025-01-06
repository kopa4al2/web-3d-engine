import { ContainerApi } from '@tweakpane/core';

export interface FilterProps {
  label: string;
  compareIgnoreCase?: boolean;
  onFilter?: (filter: string) => void;
  initialFilter?: string;
  filterValues?: FilterValue<any>;
}

type FilterValue<T> = {
  allValues: T[];
  onFiltered: (filtered: T[]) => void;
  filterPredicate: (value: T, filterText: string) => boolean;
}

export default class FilterWidget<T> {
  private filter = { value: '' };

  constructor(container: ContainerApi, filterProps: FilterProps) {
    const { label } = filterProps;

    if (filterProps.initialFilter) {
      this.filter.value = filterProps.initialFilter;
    }

    const filterInput = container.addBinding(this.filter, 'value', { label });

    filterInput.controller.view.valueElement.addEventListener('input', e => {
      // @ts-ignore
      const val: string = e.target.value;

      if (filterProps.onFilter) {
        filterProps.onFilter(val);
      }

      if (filterProps.filterValues) {
        const filterPredicate = filterProps.filterValues.filterPredicate;
        const onFiltered = filterProps.filterValues.onFiltered;
        const allValues = filterProps.filterValues.allValues;

        onFiltered(allValues.filter(element => filterPredicate(element, val)));
      }
    });
  }

}