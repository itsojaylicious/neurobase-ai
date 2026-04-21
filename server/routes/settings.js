const router  = require('express').Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');
const bcrypt  = require('bcryptjs');

// GET /api/settings/profile
router.get('/profile', auth, async (req, res) => {
  res.json({
    id: req.user._id, email: req.user.email, role: req.user.role,
    display_name: req.user.displayName || '', learning_style: req.user.learningStyle || 'balanced',
    theme: req.user.theme || 'dark', has_api_key: !!req.user.geminiApiKey,
    created_at: req.user.createdAt
  });
});

// PUT /api/settings/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { display_name, learning_style, theme, role, gemini_api_key } = req.body;
    const update = {};
    if (display_name   !== undefined) update.displayName   = display_name;
    if (learning_style !== undefined) update.learningStyle = learning_style;
    if (theme          !== undefined) update.theme         = theme;
    if (role           !== undefined) update.role          = role;
    if (gemini_api_key !== undefined && gemini_api_key !== '' && gemini_api_key !== '***') update.geminiApiKey = gemini_api_key;

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    res.json({ message: 'Profile updated', role: user.role, display_name: user.displayName });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/settings/password
router.put('/password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await bcrypt.compare(current_password, user.password)))
      return res.status(400).json({ message: 'Current password is incorrect' });
    user.password = await bcrypt.hash(new_password, 10);
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
