
import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import Modal from '../components/Modal';
import { useAppContext } from '../context/AppContext';
import { Company, UserProfile } from '../types';

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
                <label className="block text-yellow-700 font-bold mb-1">Company Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400" />
            </div>
            <div>
                <label className="block text-yellow-700 font-bold mb-1">Billing Address</label>
                <textarea name="address" value={formData.address} onChange={handleChange} rows={3} className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400 text-base" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-yellow-700 font-bold mb-1">Default Rate ($)</label>
                    <input type="number" name="defaultRate" value={formData.defaultRate} onChange={handleChange} className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400" />
                </div>
                <div>
                    <label className="block text-yellow-700 font-bold mb-1">Default Per Diem ($)</label>
                    <input type="number" name="defaultPerDiem" value={formData.defaultPerDiem} onChange={handleChange} className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400" />
                </div>
            </div>
            <div className="mt-6 flex justify-end gap-4">
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
                <label className="block text-yellow-700 font-bold mb-1">Category Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400" />
            </div>
             <div className="mt-6 flex justify-end gap-4">
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
                <label className="block text-yellow-700 font-bold mb-1">Your Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400" />
            </div>
            <div>
                <label className="block text-yellow-700 font-bold mb-1">Your Address</label>
                <textarea name="address" value={formData.address} onChange={handleChange} rows={3} className="w-full bg-black text-white border-2 border-green-500 p-2 focus:outline-none focus:border-yellow-400 text-base" />
            </div>
            <div className="flex justify-end items-center gap-4">
                {isSaved && <p className="text-yellow-300 text-sm animate-pulse">Saved!</p>}
                <Button type="submit">Save Info</Button>
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
            <h2 className="font-press-start text-xl sm:text-2xl text-yellow-700 mb-6">SETTINGS</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                <div className="bg-black p-2 sm:p-4 border-2 border-green-500 pixel-corners md:col-span-2">
                    <h3 className="font-press-start text-lg sm:text-xl text-fuchsia-500 mb-2 sm:mb-4">Google Drive Sync</h3>
                    <p className="mb-4 text-sm">Link folders for automated expense tracking.</p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button onClick={() => handleLinkDrive('Expenses')} className="w-full">Link 'Expenses' Folder</Button>
                        <Button onClick={() => handleLinkDrive('BillableReceipts')} className="w-full">Link 'Billable' Folder</Button>
                        <Button onClick={handleBackup} variant="secondary" className="w-full">Backup Data to Drive</Button>
                    </div>
                </div>

                 <div className="bg-black p-2 sm:p-4 border-2 border-green-500 pixel-corners">
                    <h3 className="font-press-start text-lg sm:text-xl text-fuchsia-500 mb-2 sm:mb-4">Pay To Information</h3>
                    <UserProfileForm />
                </div>

                <div className="bg-black p-2 sm:p-4 border-2 border-green-500 pixel-corners">
                    <div className="flex justify-between items-center mb-2 sm:mb-4">
                        <h3 className="font-press-start text-lg sm:text-xl text-fuchsia-500">Company Profiles</h3>
                        <Button onClick={openAddCompanyModal} className="text-xs !px-2 !py-1">+ Add</Button>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                        {companies.map(company => (
                            <div key={company.id} className="p-3 border-2 border-green-700 bg-black pixel-corners group">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-green-500">{company.name}</p>
                                        <p className="text-sm text-green-500 whitespace-pre-line">{company.address}</p>
                                        <p className="text-sm mt-1">Rate: ${company.defaultRate}/day | Per Diem: ${company.defaultPerDiem}/day</p>
                                    </div>
                                    <Button variant="secondary" onClick={() => openEditCompanyModal(company)} className="text-xs !px-2 !py-1 opacity-0 group-hover:opacity-100 transition-opacity">Edit</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-black p-2 sm:p-4 border-2 border-green-500 pixel-corners md:col-span-2">
                    <div className="flex justify-between items-center mb-2 sm:mb-4">
                        <h3 className="font-press-start text-lg sm:text-xl text-fuchsia-500">Expense Categories</h3>
                        <Button onClick={openAddCategoryModal} className="text-xs !px-2 !py-1">+ Add</Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {expenseCategories.map(cat => (
                           <div key={cat} className="p-2 border-2 border-green-700 bg-black pixel-corners group flex justify-between items-center">
                                <p className="text-green-500 text-sm">{cat}</p>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="secondary" onClick={() => openEditCategoryModal(cat)} className="text-xs !px-1 !py-0.5">Edit</Button>
                                    <Button variant="danger" onClick={() => handleDeleteCategory(cat)} className="text-xs !px-1 !py-0.5">Del</Button>
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
