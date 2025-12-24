// backend/src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
    {
        name:{
            type: String, 
            required: [true, 'Name is required'],
            trim: true, 
            maxLength: [30, 'Name cannot exceed 30 characters'],
            minLength: [2, 'Name must be at least 2 characters']
        }, 
        email:{
            type: String, 
            required: [true, 'Email is required'], 
            trim: true, 
            unique: true,
            lowercase: true,
            match:[
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                'Please enter a valid email'
            ]
        }, 
        password:{
            type: String, 
            required: function (){
                return !this.googleId;
            },
            select: false, 
        },
        googleId:{ 
            type: String, 
            sparse: true, 
            index: true,
        },
        role:{
            type: String, 
            enum:{
                values: ['admin', 'user'],
                message: 'Role must be either user or admin',
            },
            default: 'user'
        },
        isVerified:{
            type: Boolean, 
            default: false,
        },
        verificationToken:{
            type: String, 
            select: false,
        },
        passwordResetToken:{
            type: String, 
            select: false,
        },
        passwordResetExpires:{
            type: Date, 
            select: false,
        },
        lastLogin:{
            type: Date,
            default: null,
        },
        preferences:{
            theme:{
                type: String, 
                enum: ['light', 'dark', 'system'],
                default: 'system',
            }
        },
        acceptedTermsAt:{ 
            type: Date, 
            default: Date.now,
        },
        acceptedPolicyAt:{
            type: Date, 
            default: Date.now,
        }
    },
    {
        timestamps: true, 
        toJSON:{
            transform: function(doc, ret){
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                delete ret.password;
                delete ret.verificationToken;
                delete ret.passwordResetToken;
                delete ret.passwordResetExpires;
                return ret;
            }
        }, 
        toObject:{
            transform: function(doc, ret){
                ret.id = ret._id;
                delete ret._id; 
                delete ret.__v;
                return ret;
            }
        }
    }
);

userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

userSchema.pre('save', async function(next){
    if(!this.isModified('password') || !this.password){
        return next();
    }
    try{
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch(error){
        next(error);
    }
});

userSchema.pre('save', function(next){
    if(this.isNew || this.isModified('lastLogin')){
        if(this.googleId && !this.isVerified){ 
            this.isVerified = true;
        }
    }
    next();
});

userSchema.statics.findByEmailWithPassword = function(email) {
  return this.findOne({ email }).select('+password');
};

userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generatePasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto 
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; 
    return resetToken;
};

userSchema.methods.generateVerificationToken = function(){
    const verificationToken = crypto.randomBytes(32).toString('hex');
    this.verificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');
    return verificationToken;
};

userSchema.methods.updateLastLogin = function(){
    this.lastLogin = new Date();
    return this.save({ validateBeforeSave: false });
};

userSchema.methods.isAdmin = function() {
    return this.role === 'admin';
};

userSchema.methods.getProfileData = function() {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        isVerified: this.isVerified,
        lastLogin: this.lastLogin,
        preferences: this.preferences,
        createdAt: this.createdAt,
    };
};


const User = mongoose.model('User', userSchema);
module.exports = User;