import React, { useState, useMemo, useRef } from 'react';
import { Select, Spin } from 'antd';
import axios from 'axios';
import debounce from 'lodash/debounce';

const AssetSearch = ({ placeholder, onSelect, type = 'stock', ...props }) => {
    const [fetching, setFetching] = useState(false);
    const [options, setOptions] = useState([]);
    const fetchRef = useRef(0);

    const fetchOptions = useMemo(() => {
        const loadOptions = (value) => {
            fetchRef.current += 1;
            const fetchId = fetchRef.current;
            setOptions([]);
            setFetching(true);

            axios.get(`/api/search?query=${value}`).then((res) => {
                if (fetchId !== fetchRef.current) {
                    // for fetch callback order
                    return;
                }
                // Deduplicate by code
                const uniqueItems = [];
                const seenCodes = new Set();
                res.data.forEach(item => {
                    if (!seenCodes.has(item.code)) {
                        seenCodes.add(item.code);
                        uniqueItems.push(item);
                    }
                });

                const newOptions = uniqueItems.map((item) => ({
                    label: `${item.code} - ${item.name} (${item.type === 'stock' ? '股票' : '基金'})`,
                    value: item.code,
                    item: item, 
                }));
                setOptions(newOptions);
                setFetching(false);
            });
        };

        return debounce(loadOptions, 800);
    }, []);

    return (
        <Select
            showSearch
            placeholder={placeholder}
            filterOption={false}
            onSearch={fetchOptions}
            notFoundContent={fetching ? <Spin size="small" /> : null}
            options={options}
            onChange={(value, option) => {
                if (onSelect) {
                    onSelect(option.item);
                }
            }}
            {...props}
        />
    );
};

export default AssetSearch;
