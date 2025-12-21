import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useAppContext } from '../context/AppContext';
import { Company, UserProfile } from '../types';

const inputClass = "w-full bg-gray-700 text-white border-2 border-black p-2 font-bold focus:outline-none focus:shadow-[4px_4px_0_rgba(255,255,255,0.2)] transition-shadow placeholder-gray-400";
const labelClass = "block text-white font-bold mb-1 uppercase tracking-wide text-sm";

const CompanyForm: React.FC<{ company: Company | null, onSave: (companyData: Omit<Company, 'id'>) => void, onCancel: () => void }> = ({ company, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        defaultRate: 0,
        defaultPerDiem: 0,
    });

    useEffect(() => {
        if (company) {
            setFormData({
                name: company.name,
                address: company.address,
                defaultRate: company.defaultRate,
                defaultPerDiem: company.defaultPerDiem,
            });
        } else {
            setFormData({ name: '', address: '', defaultRate: 0, defaultPerDiem: 0 });
        }
    }, [company]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-lg">
            <div>
                <label className={labelClass}>Company Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>Billing Address</label>
                <textarea name="address" value={formData.address} onChange={handleChange} rows={3} className={inputClass} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>Default Rate ($)</label>
                    <input type="number" name="defaultRate" value={formData.defaultRate} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Default Per Diem ($)</label>
                    <input type="number" name="defaultPerDiem" value={formData.defaultPerDiem} onChange={handleChange} className={inputClass} />
                </div>
            </div>
            <div className="mt-6 flex justify-end gap-4 pt-4 border-t-2 border-black">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button type="submit">Save Company</Button>
            </div>
        </form>
    );
}

const CategoryForm: React.FC<{ category?: string, onSave: (oldName: string | undefined, newName: string) => void, onCancel: () => void }> = ({ category, onSave, onCancel }) => {
    const [name, setName] = useState(category || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name) {
            onSave(category, name);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div>
                <label className={labelClass}>Category Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
            </div>
             <div className="mt-6 flex justify-end gap-4 pt-4 border-t-2 border-black">
                <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button type="submit">Save</Button>
            </div>
        </form>
    )
}

const UserProfileForm: React.FC = () => {
    const { userProfile, updateUserProfile } = useAppContext();
    const [formData, setFormData] = useState<UserProfile>(userProfile);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        setFormData(userProfile);
    }, [userProfile]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateUserProfile(formData);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-lg">
            <div>
                <label className={labelClass}>Your Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>Your Address</label>
                <textarea name="address" value={formData.address} onChange={handleChange} rows={3} className={inputClass} />
            </div>
            <div className="flex justify-end items-center gap-4 pt-2">
                {isSaved && <div className="bg-yellow-400 text-black px-2 py-1 border-2 border-black font-bold transform -rotate-2">Saved!</div>}
                <Button type="submit" className="!bg-green-400 hover:!bg-green-300 !text-black">Save Info</Button>
            </div>
        </form>
    );
}

const SettingsTab: React.FC = () => {
    const { companies, addCompany, updateCompany, expenseCategories, addExpenseCategory, updateExpenseCategory, deleteExpenseCategory } = useAppContext();
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<string | undefined>(undefined);
    
    const handleLinkDrive = (folderType: 'Expenses' | 'BillableReceipts') => alert(`This would initiate Google OAuth to link your '/RetroInvoiceTracker/${folderType}' folder.`);
    const handleBackup = () => alert('This would gather all app data as JSON and upload it to your Google Drive.');

    const openAddCompanyModal = () => { setEditingCompany(null); setIsCompanyModalOpen(true); }
    const openEditCompanyModal = (company: Company) => { setEditingCompany(company); setIsCompanyModalOpen(true); }
    const handleSaveCompany = (companyData: Omit<Company, 'id'>) => {
        if (editingCompany) {
            updateCompany({ ...companyData, id: editingCompany.id });
        } else {
            addCompany(companyData);
        }
        setIsCompanyModalOpen(false);
    }
    
    const openAddCategoryModal = () => { setEditingCategory(undefined); setIsCategoryModalOpen(true); }
    const openEditCategoryModal = (category: string) => { setEditingCategory(category); setIsCategoryModalOpen(true); }
    const handleSaveCategory = (oldName: string | undefined, newName: string) => {
        if (oldName) {
            updateExpenseCategory(oldName, newName);
        } else {
            addExpenseCategory(newName);
        }
        setIsCategoryModalOpen(false);
    }
    const handleDeleteCategory = (category: string) => {
        if (window.confirm(`Are you sure you want to delete the "${category}" category?`)) {
            deleteExpenseCategory(category);
        }
    }

    return (
        <div>
            <h2 className="text-3xl sm:text-4xl transform -rotate-1 relative mb-6">
                <span className="bg-green-400 text-black px-2 border-2 border-black shadow-[4px_4px_0_black]">SETTINGS</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                <div className="bg-gray-700 p-4 border-[3px] border-black comic-shadow md:col-span-2 relative overflow-hidden">
                     {/* Decorative Half-tone background for this card */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 rounded-full blur-xl opacity-20 pointer-events-none"></div>
                    <h3 className="font-comic-title text-2xl text-green-400 mb-4 border-b-2 border-green-400 inline-block [text-shadow:2px_2px_0_black]">Google Drive Sync</h3>
                    <p className="mb-4 text-sm font-bold text-gray-300">Link folders for automated expense tracking.</p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button onClick={() => handleLinkDrive('Expenses')} className="w-full !bg-green-400 hover:!bg-green-300 !text-black">Link 'Expenses' Folder</Button>
                        <Button onClick={() => handleLinkDrive('BillableReceipts')} className="w-full !bg-green-400 hover:!bg-green-300 !text-black">Link 'Billable' Folder</Button>
                        <Button onClick={handleBackup} variant="secondary" className="w-full">Backup Data</Button>
                    </div>
                </div>

                 <div className="bg-gray-700 p-4 border-[3px] border-black comic-shadow">
                    <h3 className="font-comic-title text-2xl text-green-400 mb-4 border-b-2 border-green-400 inline-block [text-shadow:2px_2px_0_black]">Pay To Information</h3>
                    <UserProfileForm />
                </div>

                <div className="bg-gray-700 p-4 border-[3px] border-black comic-shadow">
                    <div className="flex justify-between items-center mb-4 border-b-2 border-green-400 pb-2">
                        <h3 className="font-comic-title text-2xl text-green-400 [text-shadow:2px_2px_0_black]">Company Profiles</h3>
                        <Button onClick={openAddCompanyModal} className="text-xs !px-3 !py-1 !bg-green-400 hover:!bg-green-300 !text-black tracking-wider">+ Add</Button>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {companies.map(company => (
                            <div key={company.id} className="p-3 border-2 border-black bg-gray-600 group hover:bg-yellow-900 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-white text-lg">{company.name}</p>
                                        <p className="text-sm text-gray-300 whitespace-pre-line font-bold">{company.address}</p>
                                        <p className="text-xs mt-1 bg-black text-white inline-block px-1">Rate: ${company.defaultRate}/day</p>
                                    </div>
                                    <Button variant="secondary" onClick={() => openEditCompanyModal(company)} className="text-xs !px-2 !py-1 !border opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">Edit</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-700 p-4 border-[3px] border-black comic-shadow md:col-span-2">
                    <div className="flex justify-between items-center mb-4 border-b-2 border-green-400 pb-2">
                        <h3 className="font-comic-title text-2xl text-green-400 [text-shadow:2px_2px_0_black]">Expense Categories</h3>
                        <Button onClick={openAddCategoryModal} className="text-xs !px-3 !py-1 !bg-green-400 hover:!bg-green-300 !text-black tracking-wider">+ Add</Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {expenseCategories.map(cat => (
                           <div key={cat} className="p-2 border-2 border-black bg-cyan-900 hover:bg-cyan-800 transition-colors group flex justify-between items-center shadow-[2px_2px_0_rgba(0,0,0,0.5)]">
                                <p className="text-white font-bold uppercase tracking-wide text-sm truncate">{cat}</p>
                                <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="secondary" onClick={() => openEditCategoryModal(cat)} className="text-xs !px-1 !py-0.5 border">Edit</Button>
                                    <Button variant="danger" onClick={() => handleDeleteCategory(cat)} className="text-xs !px-1 !py-0.5 border">Del</Button>
                                </div>
                           </div> 
                        ))}
                    </div>
                </div>
            </div>

            <Modal isOpen={isCompanyModalOpen} onClose={() => setIsCompanyModalOpen(false)} title={editingCompany ? 'Edit Company' : 'Add New Company'}>
                <CompanyForm company={editingCompany} onSave={handleSaveCompany} onCancel={() => setIsCompanyModalOpen(false)} />
            </Modal>

            <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title={editingCategory ? 'Edit Category' : 'Add New Category'}>
                <CategoryForm category={editingCategory} onSave={handleSaveCategory} onCancel={() => setIsCategoryModalOpen(false)} />
            </Modal>
        </div>
    );
};

export default SettingsTab;