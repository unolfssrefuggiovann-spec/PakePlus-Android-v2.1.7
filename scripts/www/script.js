// 全局配置与初始化
document.addEventListener('DOMContentLoaded', () => {
    // 1. 先初始化所有界面
    HomeModule.init();
    AlbumModule.init();
    TodoModule.init();
    KitchenModule.init();
    AnniversaryModule.init();
    HealthModule.init();
    
    // 2. 启动同步模块（会自动检查更新）
    SyncModule.init();

    // 初始化日期控件默认值
    const today = new Date().toISOString().split('T')[0];
    const weightDate = document.getElementById('weight-date');
    if(weightDate) weightDate.value = today;
    const anniDate = document.getElementById('anni-date');
    if(anniDate) anniDate.value = today;
});

// 通用工具：文件转Base64
const FileUtils = {
    toBase64: (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    })
};

// 全局刷新：当同步到新数据时，刷新所有模块的显示
function refreshAllModules() {
    HomeModule.init();
    AlbumModule.render();
    TodoModule.render();
    KitchenModule.renderCategories();
    KitchenModule.renderRecipes();
    AnniversaryModule.render();
    HealthModule.init(); // 刷新健康模块
}

// 视图切换逻辑
function switchModule(moduleId) {
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active-module'));
    document.getElementById(moduleId).classList.add('active-module');
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-item[data-target="${moduleId}"]`);
    if(activeBtn) activeBtn.classList.add('active');
}

// ------------------------------------------
// 提示框工具 (Toast)
// ------------------------------------------
const Toast = {
    show(message, type = 'info') {
        const div = document.createElement('div');
        div.className = `toast toast-${type}`;
        div.innerHTML = message;
        document.body.appendChild(div);
        
        // 样式需配合 CSS，这里动态添加基础样式
        div.style.position = 'fixed';
        div.style.top = '20px';
        div.style.left = '50%';
        div.style.transform = 'translateX(-50%)';
        div.style.padding = '10px 20px';
        div.style.borderRadius = '20px';
        div.style.color = 'white';
        div.style.fontSize = '14px';
        div.style.zIndex = '9999';
        div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        div.style.opacity = '0';
        div.style.transition = '0.3s';

        if(type === 'success') div.style.background = '#4CAF50';
        else if(type === 'error') div.style.background = '#f44336';
        else div.style.background = '#2196F3';

        setTimeout(() => div.style.opacity = '1', 10);
        setTimeout(() => {
            div.style.opacity = '0';
            setTimeout(() => div.remove(), 300);
        }, 3000);
    }
};

// ------------------------------------------
// 1. 主页模块
// ------------------------------------------
const HomeModule = {
    quotes: [
        "每一个和你在一起的日子，都是奇迹。",
        "斯人若彩虹，遇上方知有。",
        "我想和你一起虚度时光。",
        "醒来觉得甚是爱你。",
        "喜欢你，是我做过最坚持的事。"
    ],
    
    init() {
        const storedDate = localStorage.getItem('loveStartDate');
        const picker = document.getElementById('start-date-picker');
        const settings = document.getElementById('home-settings');
        
        if (storedDate) {
            picker.value = storedDate;
            this.startTimer(storedDate);
        } else {
            settings.classList.remove('hidden');
        }

        // 防止重复绑定
        picker.onchange = (e) => {
            localStorage.setItem('loveStartDate', e.target.value);
            this.startTimer(e.target.value);
            this.toggleSettings(); 
            SyncModule.triggerAutoUpload(); // 自动同步
        };

        if(!this.quoteTimer) {
            let quoteIndex = 0;
            this.quoteTimer = setInterval(() => {
                quoteIndex = (quoteIndex + 1) % this.quotes.length;
                const qEl = document.getElementById('love-quote');
                if(qEl) {
                    qEl.style.opacity = 0;
                    setTimeout(() => {
                        qEl.innerText = `"${this.quotes[quoteIndex]}"`;
                        qEl.style.opacity = 1;
                    }, 500);
                }
            }, 5000);
        }
    },

    toggleSettings() {
        document.getElementById('home-settings').classList.toggle('hidden');
    },

    startTimer(startDateStr) {
        const update = () => {
            const start = new Date(startDateStr);
            const now = new Date();
            const diff = now - start;
            if (diff < 0) { document.getElementById('timer-display').innerText = "未来可期"; return; }
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            document.getElementById('timer-display').innerText = `${days} 天 ${hours} 小时 ${mins} 分`;
        };
        update();
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = setInterval(update, 60000); 
    }
};

// ------------------------------------------
// 2. 备忘录模块
// ------------------------------------------
const TodoModule = {
    todos: [],
    alarmSound: new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'),
    
    init() {
        this.todos = JSON.parse(localStorage.getItem('todos')) || [];
        this.render();
        if(!this.checkTimer) this.checkTimer = setInterval(() => this.checkReminders(), 60000);
    },

    requestPermission() {
        if (!("Notification" in window)) {
            alert("此浏览器不支持系统通知");
        } else {
            Notification.requestPermission().then(permission => {
                if(permission === 'granted') {
                    Toast.show("✅ 通知权限已开启", 'success');
                    this.alarmSound.volume = 0;
                    this.alarmSound.play().then(() => {
                        this.alarmSound.pause();
                        this.alarmSound.volume = 1;
                    }).catch(e => console.log("预加载声音失败"));
                }
            });
        }
    },

    add() {
        const text = document.getElementById('todo-input').value;
        const remark = document.getElementById('todo-remark').value; 
        const time = document.getElementById('todo-time').value;
        const remindBefore = parseInt(document.getElementById('todo-remind').value);
        const type = document.getElementById('todo-type').value;
        
        if(text) {
            this.todos.push({
                id: Date.now(),
                text, remark, time, remindBefore, type,
                status: 'pending', notified: false
            });
            this.save();
            this.render();
            document.getElementById('todo-input').value = '';
            document.getElementById('todo-remark').value = ''; 
            SyncModule.triggerAutoUpload(); // 自动同步
        }
    },

    toggleStatus(id, newStatus) {
        const todo = this.todos.find(t => t.id === id);
        if(todo) {
            todo.status = newStatus;
            this.save();
            this.render();
            SyncModule.triggerAutoUpload(); // 自动同步
        }
    },

    delete(id) {
        if(!confirm("删除此事项？")) return;
        this.todos = this.todos.filter(t => t.id !== id);
        this.save();
        this.render();
        SyncModule.triggerAutoUpload(); // 自动同步
    },

    save() {
        this.todos.sort((a,b) => {
            if(a.status === 'pending' && b.status !== 'pending') return -1;
            if(a.status !== 'pending' && b.status === 'pending') return 1;
            return new Date(a.time) - new Date(b.time);
        });
        localStorage.setItem('todos', JSON.stringify(this.todos));
    },

    checkReminders() {
        if (Notification.permission !== "granted") return;
        const now = new Date();
        this.todos.forEach(todo => {
            if (todo.status === 'pending' && !todo.notified && todo.time && todo.remindBefore >= 0) {
                const targetTime = new Date(todo.time);
                const remindTime = new Date(targetTime.getTime() - todo.remindBefore * 60000);
                
                if (now >= remindTime && now < targetTime) {
                    const isAlarm = todo.type === 'alarm';
                    const title = isAlarm ? "⏰ 闹钟提醒！" : "🔔 备忘录提醒";
                    const bodyText = todo.remark ? `${todo.text}\n备注：${todo.remark}` : todo.text; 

                    new Notification(title, {
                        body: `${bodyText}\n时间：${targetTime.toLocaleString([], {hour:'2-digit', minute:'2-digit'})}`,
                        icon: 'https://cdn-icons-png.flaticon.com/512/2913/2913520.png',
                        requireInteraction: isAlarm, 
                        vibrate: isAlarm ? [200, 100, 200] : null
                    });

                    if (isAlarm) {
                        this.playAlarm();
                        if (navigator.vibrate) navigator.vibrate([1000, 500, 1000, 500, 1000]);
                    }

                    todo.notified = true;
                    this.save();
                }
            }
        });
    },

    playAlarm() {
        this.alarmSound.currentTime = 0;
        this.alarmSound.loop = false; 
        this.alarmSound.volume = 1;
        this.alarmSound.play().catch(e => console.log("播放拦截", e));
    },

    render() {
        const container = document.getElementById('todo-list');
        if(!container) return;
        container.innerHTML = this.todos.map(t => {
            let icon = '<i class="fas fa-check"></i>';
            let statusClass = '';
            if(t.status === 'done') { icon = '<i class="fas fa-check"></i>'; statusClass = 'checked'; }
            if(t.status === 'failed') { icon = '<i class="fas fa-times"></i>'; statusClass = 'failed'; }
            
            const timeStr = t.time ? new Date(t.time).toLocaleString([], {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '无时间';
            const typeIcon = t.type === 'alarm' ? '⏰' : '🔔'; 
            let remindText = t.remindBefore === -1 ? '(🔕)' : (t.remindBefore === 0 ? '(⚡准时)' : '');
            const remarkHtml = t.remark ? `<div style="font-size:12px; color:#888; margin-top:2px;">📝 ${t.remark}</div>` : '';

            return `
            <div class="todo-item ${t.status}">
                <div class="todo-left">
                    <div class="checkbox ${statusClass}" onclick="TodoModule.cycleStatus(${t.id}, '${t.status}')">
                        ${t.status !== 'pending' ? icon : ''}
                    </div>
                    <div class="todo-content">
                        <strong>${typeIcon} ${t.text} ${remindText}</strong>
                        ${remarkHtml}
                        <small>🕒 ${timeStr}</small>
                    </div>
                </div>
                <div class="todo-actions">
                    <i class="fas fa-trash-alt" onclick="TodoModule.delete(${t.id})"></i>
                </div>
            </div>`;
        }).join('');
    }
};

// ------------------------------------------
// 3. 相册模块
// ------------------------------------------
const AlbumModule = {
    photos: [],
    currentPage: 0,
    itemsPerPage: 4,
    
    init() { 
        this.photos = JSON.parse(localStorage.getItem('albumPhotos')) || [];
        this.render(); 
    },

    addPhoto() {
        openModal(`
            <h3>📸 添加美好回忆</h3>
            <label class="btn full-width" style="text-align:center; display:block; margin-bottom:10px;">
                选择图片 (本地)
                <input id="img-file" type="file" accept="image/*" style="display:none" onchange="document.getElementById('file-name').innerText = this.files[0].name">
            </label>
            <p id="file-name" style="font-size:12px; color:#666; text-align:center; margin-bottom:10px;">未选择文件</p>
            <input id="img-date" type="date" value="${new Date().toISOString().split('T')[0]}">
            <input id="img-loc" placeholder="地点">
            <textarea id="img-note" placeholder="写下备注..."></textarea>
            <button class="btn-primary full-width" onclick="AlbumModule.savePhoto()">保存</button>
        `);
    },

    async savePhoto() {
        const fileInput = document.getElementById('img-file');
        let imgUrl = 'https://via.placeholder.com/300?text=No+Image';
        if (fileInput.files && fileInput.files[0]) {
            try { imgUrl = await FileUtils.toBase64(fileInput.files[0]); } catch(e){}
        }
        this.photos.unshift({
            id: Date.now(),
            url: imgUrl,
            date: document.getElementById('img-date').value,
            location: document.getElementById('img-loc').value,
            note: document.getElementById('img-note').value
        });
        localStorage.setItem('albumPhotos', JSON.stringify(this.photos));
        closeModal();
        this.currentPage = 0;
        this.render();
        SyncModule.triggerAutoUpload(); // 自动同步
    },

    editPhoto(id) {
        const p = this.photos.find(photo => photo.id === id);
        if(!p) return;
        event.stopPropagation(); 
        openModal(`
            <h3>编辑信息</h3>
            <input id="edit-date" type="date" value="${p.date}">
            <input id="edit-loc" value="${p.location}" placeholder="地点">
            <textarea id="edit-note" placeholder="备注">${p.note || ''}</textarea>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button class="btn full-width" style="color:red" onclick="AlbumModule.deletePhoto(${id})">删除</button>
                <button class="btn-primary full-width" onclick="AlbumModule.updatePhoto(${id})">保存</button>
            </div>
        `);
    },

    updatePhoto(id) {
        const p = this.photos.find(photo => photo.id === id);
        if(p) {
            p.date = document.getElementById('edit-date').value;
            p.location = document.getElementById('edit-loc').value;
            p.note = document.getElementById('edit-note').value;
            localStorage.setItem('albumPhotos', JSON.stringify(this.photos));
            closeModal();
            this.render();
            SyncModule.triggerAutoUpload(); // 自动同步
        }
    },

    deletePhoto(id) {
        if(confirm("确定删除？")) {
            this.photos = this.photos.filter(p => p.id !== id);
            localStorage.setItem('albumPhotos', JSON.stringify(this.photos));
            closeModal();
            this.render();
            SyncModule.triggerAutoUpload(); // 自动同步
        }
    },

    showLightbox(url, note) {
        const lb = document.getElementById('lightbox');
        document.getElementById('lightbox-img').src = url;
        document.getElementById('lightbox-caption').innerText = note || '';
        lb.classList.remove('hidden');
    },

    render() {
        const book = document.getElementById('book');
        if(!book) return;
        const start = this.currentPage * this.itemsPerPage;
        const pagePhotos = this.photos.slice(start, start + this.itemsPerPage);
        const totalPages = Math.ceil(this.photos.length / this.itemsPerPage) || 1;

        let html = '<div class="photo-grid">';
        for(let i=0; i<4; i++) {
            const p = pagePhotos[i];
            if(p) {
                html += `
                <div class="photo-item" onclick="AlbumModule.showLightbox('${p.url}', '${p.note}')">
                    <div class="photo-img-box">
                        <img src="${p.url}">
                    </div>
                    <div class="photo-meta">
                        <span>📅 ${p.date} <br> 📍 ${p.location || '未知'}</span>
                        <i class="fas fa-pen" style="padding:5px;" onclick="AlbumModule.editPhoto(${p.id})"></i>
                    </div>
                </div>`;
            } else {
                html += `<div class="photo-item" style="opacity:0; pointer-events:none;"></div>`;
            }
        }
        html += '</div>';
        
        book.innerHTML = html;
        document.getElementById('page-indicator').innerText = `第 ${this.currentPage + 1} 页 / 共 ${totalPages} 页`;
    },

    nextPage() {
        if ((this.currentPage + 1) * this.itemsPerPage < this.photos.length) {
            this.currentPage++;
            this.render();
        }
    },
    prevPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.render();
        }
    }
};

// ------------------------------------------
// 4. 纪念日模块
// ------------------------------------------
const AnniversaryModule = {
    events: [],

    init() { 
        this.events = JSON.parse(localStorage.getItem('anniEvents')) || [];
        this.render(); 
    },

    add() {
        const name = document.getElementById('anni-name').value;
        const date = document.getElementById('anni-date').value;
        if(name && date) {
            this.events.push({ id: Date.now(), name, startDate: date });
            this.save();
            this.render();
            document.getElementById('anni-name').value = '';
            SyncModule.triggerAutoUpload(); // 自动同步
        }
    },
    
    delete(id) {
        if(confirm("删除此纪念日？")) {
            this.events = this.events.filter(e => e.id !== id);
            this.save();
            this.render();
            SyncModule.triggerAutoUpload(); // 自动同步
        }
    },

    save() {
        localStorage.setItem('anniEvents', JSON.stringify(this.events));
    },

    render() {
        const list = document.getElementById('anni-list');
        if(!list) return;
        const today = new Date();
        today.setHours(0,0,0,0);

        const computedEvents = this.events.map(e => {
            const start = new Date(e.startDate);
            let nextDate = new Date(start);
            nextDate.setFullYear(today.getFullYear());
            if (nextDate < today) nextDate.setFullYear(today.getFullYear() + 1);
            
            const diffTime = nextDate - today;
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const nth = nextDate.getFullYear() - start.getFullYear();

            return { ...e, daysLeft, nth, nextDate };
        });

        computedEvents.sort((a,b) => a.daysLeft - b.daysLeft);

        list.innerHTML = computedEvents.map(e => `
            <li>
                <div style="flex:1">
                    <div style="display:flex; align-items:baseline;">
                        <span class="anni-highlight">${e.daysLeft === 0 ? '今天!' : e.daysLeft + '天'}</span>
                        <span>后是 ${e.name}</span>
                    </div>
                    <div class="anni-desc">
                        目标日：${e.nextDate.toLocaleDateString()} (${e.nth}周年) <br>
                        起始日：${e.startDate}
                    </div>
                </div>
                <button class="delete-btn" onclick="AnniversaryModule.delete(${e.id})">&times;</button>
            </li>
        `).join('');
    }
};

// ------------------------------------------
// 5. 厨房模块
// ------------------------------------------
const KitchenModule = {
    recipes: [],
    categories: [],
    currentCat: '全部',
    
    init() { 
        this.recipes = JSON.parse(localStorage.getItem('recipes')) || [];
        this.categories = JSON.parse(localStorage.getItem('categories')) || ['全部', '家常菜', '甜点', '大餐'];
        this.renderCategories(); 
        this.renderRecipes(); 
    },

    renderCategories() {
        const container = document.getElementById('category-list-container');
        if(!container) return;
        container.innerHTML = this.categories.map(cat => `
            <button class="category-tag ${this.currentCat === cat ? 'active' : ''}" onclick="KitchenModule.filter('${cat}')">${cat}</button>
        `).join('');
    },

    manageCategories() {
        const listHtml = this.categories.map((cat, index) => {
            if(cat === '全部') return ''; 
            return `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center; background:#f9f9f9; padding:8px; border-radius:8px;">
                    <span style="font-weight:500;">${cat}</span>
                    <div>
                        <button class="btn" style="padding:5px 10px; font-size:12px; margin-right:5px;" onclick="KitchenModule.renameCategory(${index})">🖊️</button>
                        <button class="btn" style="padding:5px 10px; font-size:12px; color:red;" onclick="KitchenModule.deleteCategory(${index})">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');

        openModal(`
            <h3>📂 分类管理</h3>
            <div style="max-height:300px; overflow-y:auto; margin-bottom:15px;">
                ${listHtml || '<p style="text-align:center; color:#999;">暂无自定义分类</p>'}
            </div>
            <button class="btn-primary full-width" onclick="KitchenModule.addCategoryFromModal()">+ 新增分类</button>
        `);
    },

    addCategoryFromModal() {
        const newCat = prompt("新分类名称：");
        if (newCat && !this.categories.includes(newCat)) {
            this.categories.push(newCat);
            localStorage.setItem('categories', JSON.stringify(this.categories));
            this.manageCategories(); 
            this.renderCategories(); 
            SyncModule.triggerAutoUpload(); // 自动同步
        } else if(newCat) {
            alert("分类已存在或无效");
        }
    },

    renameCategory(index) {
        const oldName = this.categories[index];
        const newName = prompt("重命名分类：", oldName);
        if(newName && newName !== oldName && !this.categories.includes(newName)) {
            this.categories[index] = newName;
            localStorage.setItem('categories', JSON.stringify(this.categories));
            
            this.recipes.forEach(r => {
                if(r.category === oldName) r.category = newName;
            });
            localStorage.setItem('recipes', JSON.stringify(this.recipes));

            if(this.currentCat === oldName) this.currentCat = newName;
            this.manageCategories();
            this.renderCategories();
            this.renderRecipes();
            alert(`修改成功，已同步更新 ${updatedCount} 道菜谱的分类。`);
            SyncModule.triggerAutoUpload(); // 自动同步
        } else if(newName) {
            alert("名称无效或已存在");
        }
    },

    deleteCategory(index) {
        const catName = this.categories[index];
        if(confirm(`确定删除分类【${catName}】吗？\n该分类下的菜谱将被移动到“未分类”。`)) {
            this.categories.splice(index, 1);
            localStorage.setItem('categories', JSON.stringify(this.categories));
            
            this.recipes.forEach(r => {
                if(r.category === catName) r.category = '未分类';
            });
            localStorage.setItem('recipes', JSON.stringify(this.recipes));

            if(this.currentCat === catName) this.currentCat = '全部';
            this.manageCategories();
            this.renderCategories();
            this.renderRecipes();
            SyncModule.triggerAutoUpload(); // 自动同步
        }
    },

    filter(cat) { this.currentCat = cat; this.renderCategories(); this.renderRecipes(); },
    
    addRecipe() {
        const catOptions = this.categories.filter(c => c !== '全部').map(c => `<option>${c}</option>`).join('');
        openModal(`
            <h3>🍴 新建菜谱</h3>
            <input id="r-name" placeholder="菜名">
            <select id="r-cat">${catOptions}</select>
            <label class="btn full-width" style="text-align:center; display:block; margin-top:5px;">
                上传成品图
                <input id="r-file" type="file" accept="image/*" style="display:none" onchange="document.getElementById('r-file-name').innerText = this.files[0].name">
            </label>
            <p id="r-file-name" style="font-size:12px; color:#666; text-align:center;">未选择文件</p>
            <textarea id="r-mat" placeholder="所需材料..." rows="3"></textarea>
            <textarea id="r-step" placeholder="做法步骤..." rows="5"></textarea>
            <button class="btn-primary full-width" onclick="KitchenModule.save()">保存</button>
        `);
    },
    async save() {
        const fileInput = document.getElementById('r-file');
        let imgUrl = 'https://source.unsplash.com/random/200x200?food';
        if (fileInput.files && fileInput.files[0]) {
            try { imgUrl = await FileUtils.toBase64(fileInput.files[0]); } catch (e) {}
        }
        this.recipes.push({
            id: Date.now(),
            name: document.getElementById('r-name').value,
            category: document.getElementById('r-cat').value,
            materials: document.getElementById('r-mat').value,
            steps: document.getElementById('r-step').value,
            image: imgUrl
        });
        localStorage.setItem('recipes', JSON.stringify(this.recipes));
        closeModal();
        this.filter(document.getElementById('r-cat').value);
        SyncModule.triggerAutoUpload(); // 自动同步
    },
    deleteRecipe(id) {
        if(confirm("删除？")) {
            this.recipes = this.recipes.filter(r => r.id !== id);
            localStorage.setItem('recipes', JSON.stringify(this.recipes));
            this.renderRecipes();
            SyncModule.triggerAutoUpload(); // 自动同步
        }
    },
    renderRecipes() {
        const list = this.currentCat === '全部' ? this.recipes : this.recipes.filter(r => r.category === this.currentCat);
        const container = document.getElementById('recipe-list');
        if(!container) return;
        container.innerHTML = list.map(r => `
            <div class="recipe-card">
                <img src="${r.image}" onclick="alert('材料：\\n${r.materials}\\n\\n做法：\\n${r.steps}')">
                <div class="recipe-info">
                    <h4>${r.name}</h4>
                    <p style="color:#999; font-size:12px;">${r.category}</p>
                    <div class="recipe-actions"><i class="fas fa-trash-alt action-icon" onclick="KitchenModule.deleteRecipe(${r.id})"></i></div>
                </div>
            </div>
        `).join('');
    }
};

// ------------------------------------------
// 6. 健康模块
// ------------------------------------------
const HealthModule = {
    weights: [],
    chart: null,
    
    init() {
        this.weights = JSON.parse(localStorage.getItem('weightData')) || [];
        this.cleanData(); 
        const lastP = localStorage.getItem('lastPeriodDate');
        if(lastP && document.getElementById('last-period-date')) document.getElementById('last-period-date').value = lastP;
        if(document.getElementById('cycle-length')) document.getElementById('cycle-length').value = localStorage.getItem('cycleLength') || 28;
        if(document.getElementById('period-duration')) document.getElementById('period-duration').value = localStorage.getItem('periodDuration') || 5;
        this.updatePeriod();
        this.initChart();
    },

    cleanData() {
        const cleanMap = new Map();
        this.weights.forEach(w => {
            let dateStr = w.date;
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if(parts.length === 3) dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
            cleanMap.set(dateStr, w.value);
        });
        this.weights = Array.from(cleanMap, ([date, value]) => ({ date, value }));
        this.weights.sort((a,b) => new Date(a.date) - new Date(b.date));
        localStorage.setItem('weightData', JSON.stringify(this.weights));
    },

    updatePeriod() {
        const lastDateInput = document.getElementById('last-period-date');
        if (!lastDateInput) return;
        
        const lastDateStr = lastDateInput.value;
        const cycle = parseInt(document.getElementById('cycle-length').value) || 28;
        const duration = parseInt(document.getElementById('period-duration').value) || 5;
        
        // 只有当有值的时候才保存，防止初始化覆盖
        if(lastDateStr) localStorage.setItem('lastPeriodDate', lastDateStr);
        localStorage.setItem('cycleLength', cycle);
        localStorage.setItem('periodDuration', duration);

        // 如果没有日期，就不渲染日历
        if (!lastDateStr) return;

        const lastDate = new Date(lastDateStr);
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';
        const today = new Date(); today.setHours(0,0,0,0);
        for (let i = 0; i < 35; i++) {
            const currentDay = new Date(lastDate);
            currentDay.setDate(lastDate.getDate() + i);
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            cell.innerText = currentDay.getDate();
            if(currentDay.getTime() === today.getTime()) cell.classList.add('today');
            const dayOfCycle = Math.floor((currentDay - lastDate) / (1000 * 60 * 60 * 24)) % cycle;
            if (dayOfCycle >= 0 && dayOfCycle < duration) cell.classList.add('period');
            else if (dayOfCycle === cycle - 14) cell.classList.add('ovulation');
            grid.appendChild(cell);
        }
        
        // 添加事件监听时要避免死循环，这里只在change时触发上传
        // 初始化时不触发
    },
    
    // 专门用于触发上传的包装函数
    onPeriodChange() {
        this.updatePeriod();
        SyncModule.triggerAutoUpload();
    },

    addWeight() {
        const val = document.getElementById('weight-val').value;
        const dateVal = document.getElementById('weight-date').value;
        if (val && dateVal) {
            const idx = this.weights.findIndex(w => w.date === dateVal);
            if(idx > -1) this.weights[idx].value = val; else this.weights.push({ date: dateVal, value: val });
            this.weights.sort((a,b) => new Date(a.date) - new Date(b.date));
            if(this.weights.length > 30) this.weights = this.weights.slice(-30);
            localStorage.setItem('weightData', JSON.stringify(this.weights));
            this.updateChart();
            alert("已记录");
            SyncModule.triggerAutoUpload(); // 自动同步
        }
    },
    initChart() {
        const cvs = document.getElementById('weightChart');
        if(!cvs) return;
        const ctx = cvs.getContext('2d');
        if(this.chart) this.chart.destroy();
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.weights.map(w => w.date.slice(5)),
                datasets: [{ label: '体重 (kg)', data: this.weights.map(w => w.value), borderColor: '#ff7b9c', backgroundColor: 'rgba(255, 123, 156, 0.1)', tension: 0.3, fill: true }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: false } } }
        });
    },
    updateChart() {
        if(this.chart) {
            this.chart.data.labels = this.weights.map(w => w.date.slice(5));
            this.chart.data.datasets[0].data = this.weights.map(w => w.value);
            this.chart.update();
        }
    }
};

// 绑定健康模块的事件，确保数据变动时触发同步
document.addEventListener('DOMContentLoaded', () => {
    const pDate = document.getElementById('last-period-date');
    if(pDate) pDate.onchange = () => HealthModule.onPeriodChange();
    const pLen = document.getElementById('period-duration');
    if(pLen) pLen.onchange = () => HealthModule.onPeriodChange();
    const cLen = document.getElementById('cycle-length');
    if(cLen) cLen.onchange = () => HealthModule.onPeriodChange();
});


// ------------------------------------------
// 7. 云同步模块 (自动同步版)
// ------------------------------------------
// ------------------------------------------
// 7. 云同步模块 (智能唤醒版)
// ------------------------------------------
const SyncModule = {
    davUrl: "https://dav.jianguoyun.com/dav/",
    fileName: "our_love_data_v2.json", 
    config: JSON.parse(localStorage.getItem('syncConfig')) || { email: '', password: '' },
    isSyncing: false,

    init() {
        if (this.config.email && this.config.password) {
            this.showActionPanel();
            
            // 1. 启动时立即检查
            this.autoCheck(); 

            // 2. 定时轮询 (每60秒，作为兜底)
            setInterval(() => this.autoCheck(), 60000);

            // 3. 【核心新增】监听可见性变化：只要切回APP，立刻检查！
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") {
                    console.log("👀 应用回到前台，触发极速同步...");
                    // 只有当没有在同步时才触发，避免冲突
                    if(!this.isSyncing) {
                        this.autoCheck();
                        // 可以在这里加一个轻微的提示，让用户知道正在刷新
                        Toast.show("♻️ 正在同步最新数据...", "info");
                    }
                }
            });
        }
    },

    saveConfig() {
        const email = document.getElementById('sync-email').value;
        const password = document.getElementById('sync-password').value;
        if (email && password) {
            this.config = { email, password };
            localStorage.setItem('syncConfig', JSON.stringify(this.config));
            this.showActionPanel();
            this.log("配置保存成功，正在尝试首次同步...");
            this.downloadData(false);
        } else {
            alert("请输入完整的账号和密码");
        }
    },

    showActionPanel() {
        const loginPanel = document.getElementById('sync-login-panel');
        const actionPanel = document.getElementById('sync-action-panel');
        const statusSpan = document.getElementById('sync-status');
        
        if(loginPanel) loginPanel.classList.add('hidden');
        if(actionPanel) actionPanel.classList.remove('hidden');
        if(statusSpan) statusSpan.innerText = `✅ 自动同步中: ${this.config.email}`;
    },

    logout() {
        if(confirm("确定退出登录？退出后将无法自动同步。")) {
            this.config = { email: '', password: '' };
            localStorage.removeItem('syncConfig');
            location.reload(); 
        }
    },

    getAllData() {
        return {
            loveStartDate: localStorage.getItem('loveStartDate'),
            todos: localStorage.getItem('todos'),
            albumPhotos: localStorage.getItem('albumPhotos'),
            anniEvents: localStorage.getItem('anniEvents'),
            recipes: localStorage.getItem('recipes'),
            categories: localStorage.getItem('categories'),
            weightData: localStorage.getItem('weightData'),
            lastPeriodDate: localStorage.getItem('lastPeriodDate'),
            cycleLength: localStorage.getItem('cycleLength'),
            periodDuration: localStorage.getItem('periodDuration'),
            timestamp: Date.now()
        };
    },

    restoreData(data) {
        if (data.loveStartDate) localStorage.setItem('loveStartDate', data.loveStartDate);
        if (data.todos) localStorage.setItem('todos', data.todos);
        if (data.albumPhotos) localStorage.setItem('albumPhotos', data.albumPhotos);
        if (data.anniEvents) localStorage.setItem('anniEvents', data.anniEvents);
        if (data.recipes) localStorage.setItem('recipes', data.recipes);
        if (data.categories) localStorage.setItem('categories', data.categories);
        if (data.weightData) localStorage.setItem('weightData', data.weightData);
        if (data.lastPeriodDate) localStorage.setItem('lastPeriodDate', data.lastPeriodDate);
        if (data.cycleLength) localStorage.setItem('cycleLength', data.cycleLength);
        if (data.periodDuration) localStorage.setItem('periodDuration', data.periodDuration);
        
        if (data.timestamp) localStorage.setItem('lastSyncTimestamp', data.timestamp);
    },

    triggerAutoUpload() {
        if (this.config.email && this.config.password) {
            if(this.isSyncing) return;
            Toast.show("☁️ 正在云端保存...", "info");
            this.uploadData(true);
        }
    },

    // 自动检查逻辑
    async autoCheck() {
        if(this.isSyncing) return;
        
        try {
            // 加上时间戳参数防止缓存，确保获取的是最新文件
            const url = this.davUrl + this.fileName + "?t=" + Date.now();
            
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': 'Basic ' + btoa(this.config.email + ':' + this.config.password) }
            });

            if (response.ok) {
                const cloudData = await response.json();
                const localTs = parseInt(localStorage.getItem('lastSyncTimestamp') || '0');
                const cloudTs = cloudData.timestamp || 0;

                // 只有云端比本地新的时候才刷新，避免不必要的闪烁
                if (cloudTs > localTs) {
                    this.restoreData(cloudData);
                    refreshAllModules(); 
                    Toast.show("❤️ 收到Ta的新消息！", "success"); // 更有爱的提示
                    this.log(`同步成功: ${new Date().toLocaleTimeString()}`);
                }
            }
        } catch(e) {
            console.log("检查更新跳过:", e);
        }
    },

    async uploadData(isAuto = false) {
        if(!isAuto) this.log("⏳ 正在上传...");
        this.isSyncing = true;
        const dataStr = JSON.stringify(this.getAllData());
        
        try {
            const response = await fetch(this.davUrl + this.fileName, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Basic ' + btoa(this.config.email + ':' + this.config.password),
                    'Content-Type': 'application/json'
                },
                body: dataStr
            });

            if (response.ok || response.status === 201 || response.status === 204) {
                localStorage.setItem('lastSyncTimestamp', Date.now());
                if(!isAuto) {
                    this.log("✅ 上传成功！");
                    alert("同步成功！");
                } else {
                    this.log(`自动保存成功: ${new Date().toLocaleTimeString()}`);
                }
            } else {
                if(!isAuto) this.log(`❌ 失败: ${response.status}`);
            }
        } catch (e) {
            this.log(`❌ 错误: ${e.message}`);
        } finally {
            this.isSyncing = false;
        }
    },

    async downloadData(manual = true) {
        if(manual) this.log("⏳ 正在下载...");
        
        try {
            const response = await fetch(this.davUrl + this.fileName + "?t=" + Date.now(), {
                method: 'GET',
                headers: { 'Authorization': 'Basic ' + btoa(this.config.email + ':' + this.config.password) }
            });

            if (response.ok) {
                const data = await response.json();
                this.restoreData(data);
                refreshAllModules();
                if(manual) {
                    this.log("✅ 下载成功！");
                    alert("已获取最新数据！");
                }
            } else {
                if(manual) this.log(`❌ 下载失败: ${response.status}`);
            }
        } catch (e) {
            if(manual) this.log(`❌ 错误: ${e.message}`);
        }
    },

    log(msg) {
        const logEl = document.getElementById('sync-log');
        if(logEl) logEl.innerText = msg;
    }
};

// 通用模态框
function openModal(html) { document.getElementById('modal-body').innerHTML = html; document.getElementById('modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });